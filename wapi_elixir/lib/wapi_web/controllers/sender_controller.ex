defmodule WapiWeb.SenderController do
  use WapiWeb, :controller
  require Logger

  alias Wapi.Sender

  def send(conn, %{"whatsapp_slug" => wa_slug, "connection_slug" => conn_slug}) do
    token = get_bearer_token(conn)

    with {:ok, params} <- parse_body(conn),
         {:ok, context} <- Sender.authorize(wa_slug, conn_slug, token),
         {:ok, result} <- Sender.send_message(context, params) do
      json(conn, %{success: true, data: result})
    else
      {:error, :missing_token} ->
        conn |> put_status(401) |> json(%{error: "Missing or invalid Authorization header"})

      {:error, :whatsapp_not_found} ->
        conn |> put_status(404) |> json(%{error: "WhatsApp account not found"})

      {:error, :connection_not_found} ->
        conn |> put_status(404) |> json(%{error: "Connection not found"})

      {:error, :sender_disabled} ->
        conn |> put_status(403) |> json(%{error: "Sender is disabled for this connection"})

      {:error, :invalid_token} ->
        conn |> put_status(401) |> json(%{error: "Invalid token"})

      {:error, {:not_connected, _status}} ->
        conn |> put_status(503) |> json(%{error: "WhatsApp is not connected"})

      {:error, {:send_failed, reason}} ->
        conn |> put_status(500) |> json(%{error: "Failed to send message", details: inspect(reason)})

      {:error, :invalid_body} ->
        conn |> put_status(400) |> json(%{error: "Missing 'to' or 'message' in body"})

      {:error, reason} ->
        Logger.error("[SenderController] Unexpected error: #{inspect(reason)}")
        conn |> put_status(500) |> json(%{error: "Internal server error"})
    end
  end

  defp get_bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end

  defp parse_body(conn) do
    body = conn.body_params

    case body do
      %{"to" => to, "message" => message} when is_binary(to) and is_map(message) ->
        {:ok, %{to: to, message: message}}

      _ ->
        {:error, :invalid_body}
    end
  end
end
