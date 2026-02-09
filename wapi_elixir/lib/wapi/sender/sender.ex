defmodule Wapi.Sender do
  @moduledoc """
  Business logic for sending WhatsApp messages via the API.
  Handles authorization, message preparation, sending via Baileys, and DB persistence.
  """
  require Logger
  import Ecto.Query

  alias Wapi.Repo
  alias Wapi.Schema.{Whatsapp, Connection, Message}
  alias Wapi.WhatsApp.SessionServer

  @doc "Authorize a sender request by validating slug + token."
  def authorize(whatsapp_slug, connection_slug, token) do
    with {:token, token} when not is_nil(token) <- {:token, token},
         {:wa, %Whatsapp{} = wa} <- {:wa, Repo.get_by(Whatsapp, slug: whatsapp_slug)},
         {:conn, %Connection{} = conn} <-
           {:conn, Repo.get_by(Connection, slug: connection_slug, whatsapp_id: wa.id)},
         {:enabled, true} <- {:enabled, conn.sender_enabled},
         {:valid_token, true} <- {:valid_token, conn.sender_token == token} do
      {:ok, %{whatsapp: wa, connection: conn}}
    else
      {:token, nil} -> {:error, :missing_token}
      {:wa, nil} -> {:error, :whatsapp_not_found}
      {:conn, nil} -> {:error, :connection_not_found}
      {:enabled, false} -> {:error, :sender_disabled}
      {:valid_token, false} -> {:error, :invalid_token}
    end
  end

  @doc "Send a message and persist to database."
  def send_message(%{whatsapp: wa, connection: conn}, %{to: to, message: message}) do
    jid = normalize_jid(to)

    case SessionServer.send_message(wa.id, jid, message) do
      {:ok, result} ->
        :telemetry.execute([:wapi, :sender, :message_sent], %{count: 1}, %{
          whatsapp_id: wa.id,
          connection_id: conn.id
        })

        # Save to database
        save_sent_message(wa, conn.id, jid, result, message)
        {:ok, result}

      {:error, reason} ->
        :telemetry.execute([:wapi, :sender, :message_failed], %{count: 1}, %{
          whatsapp_id: wa.id,
          reason: inspect(reason)
        })

        {:error, {:send_failed, reason}}
    end
  end

  defp normalize_jid(to) do
    if String.contains?(to, "@") do
      to
    else
      "#{to}@s.whatsapp.net"
    end
  end

  defp save_sent_message(%Whatsapp{} = wa, connection_id, jid, result, message) do
    message_id = get_in(result, ["key", "id"])

    if message_id do
      is_group = String.contains?(jid, "@g.us")

      body =
        message["text"] ||
          message["caption"] ||
          ""

      message_type = detect_message_type(message)
      sender_id = wa.phone_number <> "@s.whatsapp.net"

      Repo.insert(
        %Message{
          id: message_id,
          whatsapp_id: wa.id,
          chat_id: jid,
          chat_type: if(is_group, do: "group", else: "personal"),
          sender_id: sender_id,
          content: result,
          body: body,
          timestamp: DateTime.utc_now(),
          from_me: true,
          message_type: message_type,
          ack_status: 1,
          sent_from_platform: true,
          sent_by_connection_id: connection_id
        },
        on_conflict: :nothing,
        conflict_target: :id
      )
    end
  rescue
    e -> Logger.error("[Sender] Failed to save message: #{inspect(e)}")
  end

  defp detect_message_type(message) do
    cond do
      Map.has_key?(message, "image") -> "image"
      Map.has_key?(message, "video") -> "video"
      Map.has_key?(message, "audio") -> "audio"
      Map.has_key?(message, "document") -> "document"
      Map.has_key?(message, "sticker") -> "sticker"
      true -> "text"
    end
  end
end
