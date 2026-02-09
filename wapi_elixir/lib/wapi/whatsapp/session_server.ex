defmodule Wapi.WhatsApp.SessionServer do
  @moduledoc """
  GenServer managing a single WhatsApp session lifecycle.

  Each WhatsApp account gets its own isolated process with:
  - Independent state and error handling
  - Exponential backoff reconnection
  - Session corruption detection and recovery
  """
  use GenServer
  require Logger

  defstruct [
    :whatsapp_id,
    :phone_number,
    :connected_at,
    :last_error,
    :session_path,
    :qr_code,
    status: :disconnected,
    retry_count: 0,
    max_retries: 10,
    retry_backoff_ms: 1_000
  ]

  @initial_backoff_ms 1_000
  @max_backoff_ms 60_000
  @max_retries 10

  # --- Public API ---

  def child_spec(whatsapp_id) do
    %{
      id: {__MODULE__, whatsapp_id},
      start: {__MODULE__, :start_link, [whatsapp_id]},
      restart: :transient
    }
  end

  def start_link(whatsapp_id) do
    GenServer.start_link(__MODULE__, whatsapp_id, name: via_tuple(whatsapp_id))
  end

  def connect(whatsapp_id) do
    GenServer.call(via_tuple(whatsapp_id), :connect, 15_000)
  end

  def disconnect(whatsapp_id) do
    GenServer.call(via_tuple(whatsapp_id), :disconnect)
  end

  def get_status(whatsapp_id) do
    GenServer.call(via_tuple(whatsapp_id), :get_status)
  catch
    :exit, _ -> :not_found
  end

  def get_qr(whatsapp_id) do
    GenServer.call(via_tuple(whatsapp_id), :get_qr)
  catch
    :exit, _ -> nil
  end

  def force_reset(whatsapp_id) do
    GenServer.call(via_tuple(whatsapp_id), :force_reset)
  end

  def send_message(whatsapp_id, jid, message) do
    GenServer.call(via_tuple(whatsapp_id), {:send_message, jid, message}, 30_000)
  end

  # --- Callbacks ---

  @impl true
  def init(whatsapp_id) do
    Logger.metadata(whatsapp_id: whatsapp_id)
    Logger.info("[SessionServer] Starting for #{whatsapp_id}")

    state = %__MODULE__{
      whatsapp_id: whatsapp_id,
      session_path: Path.join("whatsapp_sessions", whatsapp_id),
      max_retries: @max_retries,
      retry_backoff_ms: @initial_backoff_ms
    }

    # Auto-connect if session files exist
    if File.dir?(state.session_path) do
      send(self(), :auto_connect)
    end

    {:ok, state}
  end

  @impl true
  def handle_call(:connect, _from, %{status: :connected} = state) do
    {:reply, {:ok, :already_connected}, state}
  end

  def handle_call(:connect, _from, %{status: :connecting} = state) do
    {:reply, {:ok, :connecting}, state}
  end

  def handle_call(:connect, _from, state) do
    new_state = do_connect(state)
    {:reply, :ok, new_state}
  end

  def handle_call(:disconnect, _from, state) do
    new_state = do_disconnect(state)
    {:reply, :ok, new_state}
  end

  def handle_call(:get_status, _from, state) do
    {:reply, state.status, state}
  end

  def handle_call(:get_qr, _from, state) do
    {:reply, state.qr_code, state}
  end

  def handle_call(:force_reset, _from, state) do
    new_state = do_force_reset(state)
    {:reply, :ok, new_state}
  end

  def handle_call({:send_message, jid, message}, _from, %{status: :connected} = state) do
    result = Wapi.WhatsApp.NodeBridge.send_message(state.whatsapp_id, jid, message)
    {:reply, result, state}
  end

  def handle_call({:send_message, _jid, _message}, _from, state) do
    {:reply, {:error, {:not_connected, state.status}}, state}
  end

  @impl true
  def handle_info(:auto_connect, state) do
    Logger.info("[SessionServer] Auto-connecting #{state.whatsapp_id}")
    {:noreply, do_connect(state)}
  end

  def handle_info(:retry_connect, %{retry_count: count, max_retries: max} = state)
      when count >= max do
    Logger.warning("[SessionServer] Max retries (#{max}) reached for #{state.whatsapp_id}")

    Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
      status: :max_retries_reached,
      message: "Max reconnection retries reached. Manual intervention required."
    })

    {:noreply, %{state | status: :disconnected}}
  end

  def handle_info(:retry_connect, state) do
    Logger.info("[SessionServer] Retry ##{state.retry_count + 1} for #{state.whatsapp_id}")
    {:noreply, do_connect(state)}
  end

  # Events from NodeBridge
  def handle_info({:qr, qr_code}, state) do
    Logger.info("[SessionServer] QR received for #{state.whatsapp_id}")

    Phoenix.PubSub.broadcast(Wapi.PubSub, "qr:#{state.whatsapp_id}", %{
      type: :qr,
      qr: qr_code
    })

    {:noreply, %{state | status: :qr_pending, qr_code: qr_code}}
  end

  def handle_info(:connection_open, state) do
    Logger.info("[SessionServer] Connected: #{state.whatsapp_id}")

    update_db_connection(state.whatsapp_id, true)

    Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
      status: :open
    })

    :telemetry.execute([:wapi, :session, :connected], %{count: 1}, %{
      whatsapp_id: state.whatsapp_id
    })

    {:noreply,
     %{state | status: :connected, qr_code: nil, retry_count: 0, retry_backoff_ms: @initial_backoff_ms, connected_at: DateTime.utc_now()}}
  end

  def handle_info({:connection_closed, reason}, state) do
    Logger.warning("[SessionServer] Disconnected: #{state.whatsapp_id}, reason: #{inspect(reason)}")

    update_db_connection(state.whatsapp_id, false)

    :telemetry.execute([:wapi, :session, :disconnected], %{count: 1}, %{
      whatsapp_id: state.whatsapp_id,
      reason: reason
    })

    case reason do
      :logged_out ->
        do_force_reset(state)
        {:noreply, %{state | status: :disconnected, qr_code: nil}}

      :session_corrupted ->
        Logger.warning("[SessionServer] Session corruption for #{state.whatsapp_id}, clearing...")
        clear_corrupted_session(state)

        Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
          status: :session_error,
          message: "Session corrupted (Bad MAC). Please scan QR again."
        })

        new_state = schedule_retry(state)
        {:noreply, %{new_state | status: :disconnected, retry_count: state.retry_count + 1}}

      _other ->
        Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
          status: :close,
          should_reconnect: true
        })

        new_state = schedule_retry(state)
        {:noreply, %{new_state | status: :disconnected, retry_count: state.retry_count + 1, last_error: reason}}
    end
  end

  def handle_info({:contacts_upsert, contacts}, state) do
    Wapi.Pipeline.MessageProducer.push(state.whatsapp_id, %{
      "event" => "contacts.upsert",
      "contacts" => contacts
    })

    {:noreply, state}
  end

  def handle_info({:groups_upsert, groups}, state) do
    Wapi.Pipeline.MessageProducer.push(state.whatsapp_id, %{
      "event" => "groups.upsert",
      "groups" => groups
    })

    {:noreply, state}
  end

  def handle_info(msg, state) do
    Logger.debug("[SessionServer] Unhandled message: #{inspect(msg)}")
    {:noreply, state}
  end

  # --- Private ---

  defp do_connect(state) do
    Wapi.WhatsApp.NodeBridge.connect(state.whatsapp_id)
    %{state | status: :connecting}
  end

  defp do_disconnect(state) do
    Wapi.WhatsApp.NodeBridge.disconnect(state.whatsapp_id)
    update_db_connection(state.whatsapp_id, false)
    %{state | status: :disconnected, qr_code: nil}
  end

  defp do_force_reset(state) do
    do_disconnect(state)
    clear_corrupted_session(state)
    %{state | status: :disconnected, qr_code: nil, retry_count: 0, retry_backoff_ms: @initial_backoff_ms}
  end

  defp clear_corrupted_session(state) do
    if File.dir?(state.session_path) do
      Logger.info("[SessionServer] Clearing session files for #{state.whatsapp_id}")
      File.rm_rf!(state.session_path)
    end
  end

  defp schedule_retry(state) do
    backoff = min(state.retry_backoff_ms * 2, @max_backoff_ms)
    Process.send_after(self(), :retry_connect, state.retry_backoff_ms)
    %{state | retry_backoff_ms: backoff}
  end

  defp update_db_connection(whatsapp_id, connected) do
    import Ecto.Query

    Wapi.Repo.update_all(
      from(w in Wapi.Schema.Whatsapp, where: w.id == ^whatsapp_id),
      set: [connected: connected]
    )
  rescue
    e -> Logger.error("[SessionServer] DB update failed: #{inspect(e)}")
  end

  defp via_tuple(whatsapp_id) do
    {:via, Registry, {Wapi.WhatsApp.SessionRegistry, whatsapp_id}}
  end
end
