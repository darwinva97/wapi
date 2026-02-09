defmodule Wapi.Workers.CleanupWorker do
  @moduledoc """
  Oban cron worker for cleaning up expired media files.
  Runs daily at 3:00 AM. Replaces the manual cleanup-job.ts script.
  """
  use Oban.Worker,
    queue: :cleanup,
    max_attempts: 3,
    unique: [period: 3600]

  require Logger
  import Ecto.Query

  @impl true
  def perform(_job) do
    Logger.info("[Cleanup] Starting cleanup job")
    started_at = System.monotonic_time(:millisecond)

    configs =
      Wapi.Repo.all(
        from(c in Wapi.Schema.WhatsappCleanupConfig,
          where: c.cleanup_enabled == true
        )
      )

    Logger.info("[Cleanup] Processing #{length(configs)} instances")

    results = Enum.map(configs, &cleanup_instance/1)

    total_files = results |> Enum.map(& &1.files_deleted) |> Enum.sum()
    duration_ms = System.monotonic_time(:millisecond) - started_at

    Logger.info("[Cleanup] Completed in #{duration_ms}ms. Files deleted: #{total_files}")

    :telemetry.execute(
      [:wapi, :cleanup, :completed],
      %{duration_ms: duration_ms, files_deleted: total_files},
      %{instances: length(configs)}
    )

    :ok
  end

  defp cleanup_instance(config) do
    cutoff = DateTime.add(DateTime.utc_now(), -config.cleanup_days, :day)

    query =
      from(m in Wapi.Schema.Message,
        where: m.whatsapp_id == ^config.whatsapp_id,
        where: m.timestamp < ^cutoff,
        where: not is_nil(m.media_url)
      )

    query =
      if config.force_cleanup do
        query
      else
        from(m in query,
          where:
            is_nil(m.media_retention_until) or
              m.media_retention_until < ^DateTime.utc_now()
        )
      end

    # Apply chat exclusions
    excluded_chats = config.exclude_chats || []

    query =
      if excluded_chats != [] do
        from(m in query, where: m.chat_id not in ^excluded_chats)
      else
        query
      end

    messages = Wapi.Repo.all(query)
    Logger.info("[Cleanup] Found #{length(messages)} messages for #{config.whatsapp_id}")

    Enum.reduce(messages, %{files_deleted: 0, errors: []}, fn msg, acc ->
      if msg.media_url do
        case Wapi.Storage.delete_file(msg.media_url) do
          :ok ->
            Wapi.Repo.update_all(
              from(m in Wapi.Schema.Message, where: m.id == ^msg.id),
              set: [media_url: nil, media_metadata: nil]
            )

            %{acc | files_deleted: acc.files_deleted + 1}

          {:error, reason} ->
            %{acc | errors: [reason | acc.errors]}
        end
      else
        acc
      end
    end)
  end
end
