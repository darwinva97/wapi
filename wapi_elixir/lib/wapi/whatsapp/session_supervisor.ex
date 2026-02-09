defmodule Wapi.WhatsApp.SessionSupervisor do
  @moduledoc """
  DynamicSupervisor that manages WhatsApp SessionServer processes.
  Each WhatsApp account gets its own supervised GenServer.
  """
  use DynamicSupervisor
  require Logger

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc "Starts a SessionServer for a WhatsApp account. Returns existing if already running."
  def start_session(whatsapp_id) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] ->
        {:ok, pid}

      [] ->
        child_spec = {Wapi.WhatsApp.SessionServer, whatsapp_id}

        case DynamicSupervisor.start_child(__MODULE__, child_spec) do
          {:ok, pid} ->
            Logger.info("[SessionSupervisor] Started session for #{whatsapp_id}")
            {:ok, pid}

          {:error, {:already_started, pid}} ->
            {:ok, pid}

          error ->
            Logger.error("[SessionSupervisor] Failed to start #{whatsapp_id}: #{inspect(error)}")
            error
        end
    end
  end

  @doc "Stops a SessionServer."
  def stop_session(whatsapp_id) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] ->
        DynamicSupervisor.terminate_child(__MODULE__, pid)

      [] ->
        {:error, :not_found}
    end
  end

  @doc "Lists all active session IDs and their PIDs."
  def list_sessions do
    Registry.select(Wapi.WhatsApp.SessionRegistry, [
      {{:"$1", :"$2", :_}, [], [{{:"$1", :"$2"}}]}
    ])
  end

  @doc "Returns the count of active sessions."
  def count_sessions do
    list_sessions() |> length()
  end
end
