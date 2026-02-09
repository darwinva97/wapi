defmodule Wapi.Pipeline.MessageParser do
  @moduledoc """
  Parses and classifies raw WhatsApp messages from Baileys events.
  """

  @media_types ~w(image video audio sticker document)

  def parse_messages_upsert(whatsapp_id, %{"messages" => messages, "type" => type}) do
    messages
    |> Enum.map(fn msg -> parse_single_message(whatsapp_id, msg, type) end)
    |> Enum.reject(&is_nil/1)
  end

  def parse_messages_upsert(_whatsapp_id, _data), do: []

  defp parse_single_message(whatsapp_id, msg, type) do
    key = msg["key"] || %{}
    remote_jid = key["remoteJid"]

    if is_nil(remote_jid) || String.contains?(remote_jid || "", "@broadcast") do
      nil
    else
      message_content = msg["message"] || %{}

      %{
        whatsapp_id: whatsapp_id,
        message_id: key["id"],
        chat_id: remote_jid,
        chat_type: if(is_group?(remote_jid), do: "group", else: "personal"),
        from_me: key["fromMe"] || false,
        sender_id: key["participant"] || remote_jid,
        raw_content: msg,
        body: extract_message_text(message_content),
        timestamp: parse_timestamp(msg["messageTimestamp"]),
        upsert_type: type,
        message_type: detect_type(message_content),
        push_name: msg["pushName"],
        has_media: has_media?(message_content),
        media_content: extract_media_content(message_content)
      }
    end
  end

  def detect_type(nil), do: "text"
  def detect_type(message) when is_map(message) do
    cond do
      Map.has_key?(message, "reactionMessage") -> "reaction"
      Map.has_key?(message, "pollUpdateMessage") -> "poll_vote"
      Map.has_key?(message, "pollCreationMessage") -> "poll_creation"
      Map.has_key?(message, "imageMessage") -> "image"
      Map.has_key?(message, "videoMessage") -> "video"
      Map.has_key?(message, "audioMessage") -> "audio"
      Map.has_key?(message, "stickerMessage") -> "sticker"
      Map.has_key?(message, "documentMessage") -> "document"
      Map.has_key?(message, "locationMessage") -> "location"
      true -> "text"
    end
  end

  def extract_message_text(nil), do: nil
  def extract_message_text(message) when is_map(message) do
    message["conversation"] ||
      get_in(message, ["extendedTextMessage", "text"]) ||
      get_in(message, ["imageMessage", "caption"]) ||
      get_in(message, ["videoMessage", "caption"]) ||
      get_in(message, ["documentMessage", "caption"])
  end

  defp has_media?(nil), do: false
  defp has_media?(message) do
    Enum.any?(@media_types, fn type -> Map.has_key?(message, "#{type}Message") end)
  end

  defp extract_media_content(nil), do: nil
  defp extract_media_content(message) do
    Enum.find_value(@media_types, fn type ->
      key = "#{type}Message"
      if Map.has_key?(message, key), do: {type, message[key]}, else: nil
    end)
  end

  def is_group?(jid), do: String.contains?(jid || "", "@g.us")

  defp parse_timestamp(ts) when is_integer(ts) do
    DateTime.from_unix!(ts)
  end

  defp parse_timestamp(ts) when is_map(ts) do
    seconds = ts["low"] || 0
    DateTime.from_unix!(seconds)
  end

  defp parse_timestamp(_), do: DateTime.utc_now()
end
