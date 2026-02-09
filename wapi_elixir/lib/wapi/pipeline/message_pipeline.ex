defmodule Wapi.Pipeline.MessagePipeline do
  @moduledoc """
  Broadway pipeline that processes incoming WhatsApp messages.

  Stages:
  1. Producer: MessageProducer (GenStage, demand-driven)
  2. Processors: Parse, classify, and enrich messages (N concurrent workers)
  3. Batchers:
     - :database  - Batch insert, broadcast realtime, and schedule webhooks
  """
  use Broadway
  require Logger

  alias Broadway.Message
  alias Wapi.Pipeline.MessageParser

  def start_link(_opts) do
    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: [
        module: {Wapi.Pipeline.MessageProducer, []},
        concurrency: 1
      ],
      processors: [
        default: [
          concurrency: 10,
          max_demand: 5
        ]
      ],
      batchers: [
        database: [
          concurrency: 3,
          batch_size: 50,
          batch_timeout: 500
        ]
      ]
    )
  end

  # --- Processor ---

  @impl true
  def handle_message(_processor, %Message{data: raw} = message, _context) do
    whatsapp_id = raw.whatsapp_id
    data = raw.data
    event = data["event"] || "messages.upsert"

    case event do
      "messages.upsert" ->
        parsed = MessageParser.parse_messages_upsert(whatsapp_id, data)

        if parsed == [] do
          Message.failed(message, :no_messages)
        else
          message
          |> Message.update_data(fn _ -> %{whatsapp_id: whatsapp_id, messages: parsed, event: event} end)
          |> Message.put_batcher(:database)
        end

      "messages.update" ->
        message
        |> Message.update_data(fn _ -> %{whatsapp_id: whatsapp_id, updates: data["updates"] || [], event: event} end)
        |> Message.put_batcher(:database)

      _ ->
        # Pass through for other events
        Message.failed(message, {:unknown_event, event})
    end
  rescue
    e ->
      Logger.error("[Pipeline] Error processing message: #{inspect(e)}")
      Message.failed(message, e)
  end

  # --- Database Batcher ---

  @impl true
  def handle_batch(:database, messages, _batch_info, _context) do
    {upserts, updates} =
      Enum.split_with(messages, fn %Message{data: data} ->
        data.event == "messages.upsert"
      end)

    # Batch insert new messages
    if upserts != [] do
      entries =
        upserts
        |> Enum.flat_map(fn %Message{data: data} -> data.messages end)
        |> Enum.reject(fn msg -> msg.message_type in ["reaction", "poll_vote"] end)
        |> Enum.map(fn msg ->
          %{
            id: msg.message_id,
            whatsapp_id: msg.whatsapp_id,
            chat_id: msg.chat_id,
            chat_type: msg.chat_type,
            sender_id: msg.sender_id,
            content: msg.raw_content,
            body: msg.body,
            timestamp: msg.timestamp,
            from_me: msg.from_me,
            message_type: msg.message_type,
            ack_status: if(msg.from_me, do: 1, else: 2)
          }
        end)
        |> Enum.uniq_by(& &1.id)

      if entries != [] do
        try do
          {count, _} =
            Wapi.Repo.insert_all(
              Wapi.Schema.Message,
              entries,
              on_conflict: :nothing,
              conflict_target: :id
            )

          Logger.info("[Pipeline:DB] Inserted #{count}/#{length(entries)} messages")
        rescue
          e -> Logger.error("[Pipeline:DB] Batch insert failed: #{inspect(e)}")
        end
      end

      # Broadcast to realtime after DB insert
      Enum.each(upserts, fn %Message{data: data} ->
        Enum.each(data.messages, fn msg ->
          if msg.message_type not in ["reaction", "poll_vote"] do
            Phoenix.PubSub.broadcast(Wapi.PubSub, "chat:#{msg.chat_id}", %{
              event: "new_message",
              payload: %{
                id: msg.message_id,
                body: msg.body,
                timestamp: msg.timestamp,
                from_me: msg.from_me,
                sender_id: msg.sender_id,
                message_type: msg.message_type,
                ack_status: if(msg.from_me, do: 1, else: 2)
              }
            })
          end
        end)
      end)
    end

    # Process ack updates
    if updates != [] do
      process_ack_updates(updates)
    end

    # Handle webhooks
    schedule_webhooks(upserts)

    :telemetry.execute([:wapi, :pipeline, :message, :processed], %{count: length(messages)}, %{})

    messages
  end

  @impl true
  def handle_failed(messages, _context) do
    Enum.each(messages, fn
      %Message{status: {:failed, :no_messages}} -> :ok
      %Message{status: {:failed, {:unknown_event, _}}} -> :ok
      %Message{status: {:failed, reason}} ->
        Logger.warning("[Pipeline] Message failed: #{inspect(reason)}")
        :telemetry.execute([:wapi, :pipeline, :message, :failed], %{count: 1}, %{})
    end)

    messages
  end

  # --- Private ---

  defp process_ack_updates(update_messages) do
    import Ecto.Query

    Enum.each(update_messages, fn %Message{data: data} ->
      Enum.each(data.updates || [], fn update ->
        key = update["key"] || %{}
        status_update = update["update"] || %{}
        message_id = key["id"]
        chat_id = key["remoteJid"]

        new_ack =
          cond do
            status_update["status"] == 3 -> 3
            status_update["status"] == 2 -> 2
            status_update["status"] == 1 -> 1
            status_update["status"] == 0 -> 0
            status_update["readTimestamp"] || status_update["read"] -> 3
            true -> nil
          end

        if message_id && new_ack do
          Wapi.Repo.update_all(
            from(m in Wapi.Schema.Message,
              where: m.id == ^message_id and m.whatsapp_id == ^data.whatsapp_id
            ),
            set: [ack_status: new_ack]
          )

          Phoenix.PubSub.broadcast(Wapi.PubSub, "chat:#{chat_id}", %{
            event: "message_ack",
            payload: %{
              message_id: message_id,
              chat_id: chat_id,
              ack_status: new_ack
            }
          })
        end
      end)
    end)
  end

  defp schedule_webhooks(upsert_messages) do
    import Ecto.Query

    Enum.each(upsert_messages, fn %Message{data: data} ->
      # Only send webhooks for "notify" type messages
      first_msg = List.first(data.messages || [])
      if first_msg && first_msg[:upsert_type] == "notify" do
        connections =
          Wapi.Repo.all(
            from(c in Wapi.Schema.Connection,
              where: c.whatsapp_id == ^data.whatsapp_id and c.receiver_enabled == true
            )
          )

        Enum.each(connections, fn conn ->
          receiver = conn.receiver_request || %{}
          url = receiver["url"]

          if url do
            %{
              whatsapp_id: data.whatsapp_id,
              connection_id: conn.id,
              url: url,
              headers: receiver["headers"] || %{},
              payload: %{messages: Enum.map(data.messages, & &1.raw_content), type: "notify"}
            }
            |> Wapi.Workers.WebhookWorker.new(max_attempts: 5)
            |> Oban.insert()
          end
        end)
      end
    end)
  rescue
    e -> Logger.error("[Pipeline] Webhook scheduling failed: #{inspect(e)}")
  end
end
