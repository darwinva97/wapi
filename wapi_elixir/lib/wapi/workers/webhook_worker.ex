defmodule Wapi.Workers.WebhookWorker do
  @moduledoc """
  Oban worker for dispatching webhooks with retry and backoff.
  Failed webhooks are tracked as discarded jobs (dead letter queue).
  """
  use Oban.Worker,
    queue: :webhooks,
    max_attempts: 5,
    priority: 1

  require Logger

  @impl true
  def perform(%Oban.Job{args: args, attempt: attempt}) do
    %{
      "url" => url,
      "headers" => headers,
      "payload" => payload
    } = args

    Logger.info("[Webhook] Delivering to #{url} (attempt #{attempt})")

    case send_webhook(url, headers, payload) do
      {:ok, %{status: status}} when status in 200..299 ->
        Logger.info("[Webhook] Delivered to #{url} (status: #{status})")
        :telemetry.execute([:wapi, :webhook, :delivered], %{count: 1}, %{url: url})
        :ok

      {:ok, %{status: 429}} ->
        # Rate limited
        Logger.warning("[Webhook] Rate limited by #{url}, snoozing...")
        {:snooze, backoff_seconds(attempt)}

      {:ok, %{status: status}} when status in 400..499 ->
        # Client error, don't retry
        Logger.warning("[Webhook] Client error #{status} from #{url}, not retrying")
        :ok

      {:ok, %{status: status}} ->
        Logger.warning("[Webhook] Server error #{status} from #{url}, attempt #{attempt}")
        :telemetry.execute([:wapi, :webhook, :failed], %{count: 1}, %{url: url, status: status})
        {:error, "HTTP #{status}"}

      {:error, %Req.TransportError{reason: reason}} ->
        Logger.warning("[Webhook] Transport error to #{url}: #{inspect(reason)}")
        :telemetry.execute([:wapi, :webhook, :failed], %{count: 1}, %{url: url, reason: reason})
        {:error, inspect(reason)}

      {:error, reason} ->
        Logger.warning("[Webhook] Error to #{url}: #{inspect(reason)}")
        {:error, inspect(reason)}
    end
  end

  defp send_webhook(url, headers, payload) do
    Req.post(url,
      json: payload,
      headers: Map.merge(%{"content-type" => "application/json"}, headers || %{}),
      receive_timeout: 10_000,
      retry: false
    )
  end

  defp backoff_seconds(attempt) do
    min(round(10 * :math.pow(3, attempt - 1)), 300)
  end
end
