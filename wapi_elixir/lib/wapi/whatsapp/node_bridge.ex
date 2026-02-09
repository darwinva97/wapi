defmodule Wapi.WhatsApp.NodeBridge do
  @moduledoc """
  GenServer that manages communication with the Node.js Baileys sidecar process
  via Erlang Port (stdin/stdout with JSON-encoded messages).
  """
  use GenServer
  require Logger

  defstruct [:port, pending: %{}, request_id: 0, partial_buffer: ""]

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  # --- Public API ---

  def connect(whatsapp_id) do
    GenServer.cast(__MODULE__, {:command, %{action: "connect", whatsapp_id: whatsapp_id}})
  end

  def disconnect(whatsapp_id) do
    GenServer.cast(__MODULE__, {:command, %{action: "disconnect", whatsapp_id: whatsapp_id}})
  end

  def send_message(whatsapp_id, jid, message) do
    GenServer.call(__MODULE__, {:request, %{action: "send_message", whatsapp_id: whatsapp_id, jid: jid, message: message}}, 30_000)
  end

  def download_media(whatsapp_id, message_content, message_type) do
    GenServer.call(
      __MODULE__,
      {:request,
       %{
         action: "download_media",
         whatsapp_id: whatsapp_id,
         message_content: message_content,
         message_type: message_type
       }},
      30_000
    )
  end

  # --- Callbacks ---

  @impl true
  def init(:ok) do
    config = Application.get_env(:wapi, __MODULE__, [])
    node_path = Keyword.get(config, :node_path, "node")
    bridge_script = Keyword.get(config, :bridge_script, "priv/baileys-bridge/index.js")

    port = open_port(node_path, bridge_script)
    Logger.info("[NodeBridge] Started Node.js bridge process")

    {:ok, %__MODULE__{port: port}}
  end

  @impl true
  def handle_cast({:command, cmd}, state) do
    send_to_port(state.port, cmd)
    {:noreply, state}
  end

  @impl true
  def handle_call({:request, cmd}, from, state) do
    request_id = state.request_id + 1
    cmd_with_id = Map.put(cmd, :request_id, request_id)
    send_to_port(state.port, cmd_with_id)

    pending = Map.put(state.pending, request_id, from)
    {:noreply, %{state | pending: pending, request_id: request_id}}
  end

  @impl true
  def handle_info({port, {:data, {:eol, data}}}, %{port: port} = state) do
    full_line = state.partial_buffer <> data
    state = %{state | partial_buffer: ""}
    state = process_line(full_line, state)
    {:noreply, state}
  end

  def handle_info({port, {:data, {:noeol, data}}}, %{port: port} = state) do
    {:noreply, %{state | partial_buffer: state.partial_buffer <> data}}
  end

  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    Logger.error("[NodeBridge] Node.js process exited with status #{status}, restarting in 1s...")

    # Reply error to all pending requests
    Enum.each(state.pending, fn {_id, from} ->
      GenServer.reply(from, {:error, :bridge_crashed})
    end)

    Process.send_after(self(), :restart_port, 1_000)
    {:noreply, %{state | port: nil, pending: %{}}}
  end

  def handle_info(:restart_port, state) do
    config = Application.get_env(:wapi, __MODULE__, [])
    node_path = Keyword.get(config, :node_path, "node")
    bridge_script = Keyword.get(config, :bridge_script, "priv/baileys-bridge/index.js")

    new_port = open_port(node_path, bridge_script)
    Logger.info("[NodeBridge] Node.js bridge process restarted")

    reconnect_active_sessions()

    {:noreply, %{state | port: new_port}}
  end

  def handle_info(msg, state) do
    Logger.debug("[NodeBridge] Unhandled message: #{inspect(msg)}")
    {:noreply, state}
  end

  @impl true
  def terminate(_reason, %{port: port}) when not is_nil(port) do
    Port.close(port)
  catch
    _, _ -> :ok
  end

  def terminate(_reason, _state), do: :ok

  # --- Private ---

  defp open_port(node_path, bridge_script) do
    Port.open(
      {:spawn_executable, System.find_executable(node_path)},
      [
        :binary,
        :exit_status,
        {:line, 1_048_576},
        {:args, [bridge_script]},
        {:cd, File.cwd!()}
      ]
    )
  end

  defp send_to_port(port, data) do
    json = Jason.encode!(data)
    Port.command(port, json <> "\n")
  rescue
    e -> Logger.error("[NodeBridge] Failed to send command: #{inspect(e)}")
  end

  defp process_line(line, state) do
    case Jason.decode(line) do
      {:ok, %{"response_id" => id} = data} ->
        handle_response(id, data, state)

      {:ok, %{"event" => event, "whatsapp_id" => wid} = data} ->
        dispatch_event(wid, event, data)
        state

      {:ok, data} ->
        Logger.debug("[NodeBridge] Unknown message: #{inspect(data)}")
        state

      {:error, _} ->
        # Probably a log line from Node.js
        Logger.debug("[NodeBridge:stdout] #{line}")
        state
    end
  end

  defp handle_response(id, data, state) do
    case Map.pop(state.pending, id) do
      {nil, _pending} ->
        Logger.warning("[NodeBridge] Response for unknown request #{id}")
        state

      {from, pending} ->
        result =
          case data do
            %{"success" => true, "data" => result_data} -> {:ok, result_data}
            %{"success" => false, "error" => error} -> {:error, error}
            _ -> {:ok, data}
          end

        GenServer.reply(from, result)
        %{state | pending: pending}
    end
  end

  defp dispatch_event(whatsapp_id, "qr", %{"qr" => qr}) do
    send_to_session(whatsapp_id, {:qr, qr})
  end

  defp dispatch_event(whatsapp_id, "connection.open", _data) do
    send_to_session(whatsapp_id, :connection_open)
  end

  defp dispatch_event(whatsapp_id, "connection.close", %{"reason" => reason}) do
    send_to_session(whatsapp_id, {:connection_closed, safe_reason(reason)})
  end

  defp dispatch_event(whatsapp_id, "messages.upsert", data) do
    Wapi.Pipeline.MessageProducer.push(whatsapp_id, data)
  end

  defp dispatch_event(whatsapp_id, "messages.update", data) do
    Wapi.Pipeline.MessageProducer.push(whatsapp_id, Map.put(data, "event", "messages.update"))
  end

  defp dispatch_event(whatsapp_id, "contacts.upsert", data) do
    send_to_session(whatsapp_id, {:contacts_upsert, data["contacts"]})
  end

  defp dispatch_event(whatsapp_id, "groups.upsert", data) do
    send_to_session(whatsapp_id, {:groups_upsert, data["groups"]})
  end

  defp dispatch_event(whatsapp_id, "connection.connecting", _data) do
    Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{whatsapp_id}", %{
      status: :connecting
    })
  end

  defp dispatch_event(whatsapp_id, "groups.update", data) do
    send_to_session(whatsapp_id, {:groups_update, data})
  end

  defp dispatch_event(whatsapp_id, "chats.upsert", data) do
    Wapi.Pipeline.MessageProducer.push(whatsapp_id, Map.put(data, "event", "chats.upsert"))
  end

  defp dispatch_event(whatsapp_id, event, _data) do
    Logger.debug("[NodeBridge] Unhandled event #{event} for #{whatsapp_id}")
  end

  defp send_to_session(whatsapp_id, message) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] -> send(pid, message)
      [] -> Logger.warning("[NodeBridge] No session found for #{whatsapp_id}")
    end
  end

  defp reconnect_active_sessions do
    Wapi.WhatsApp.SessionSupervisor.list_sessions()
    |> Enum.each(fn {whatsapp_id, _pid} ->
      Logger.info("[NodeBridge] Re-connecting session #{whatsapp_id}")
      connect(whatsapp_id)
    end)
  end

  defp safe_reason(reason) when is_binary(reason) do
    known = %{
      "loggedOut" => :logged_out,
      "logged_out" => :logged_out,
      "connectionClosed" => :connection_closed,
      "connectionReplaced" => :connection_replaced,
      "timedOut" => :timed_out,
      "sessionCorrupted" => :session_corrupted,
      "session_corrupted" => :session_corrupted,
      "bad_mac" => :session_corrupted
    }

    Map.get(known, reason, {:unknown, reason})
  end

  defp safe_reason(reason), do: {:unknown, inspect(reason)}
end
