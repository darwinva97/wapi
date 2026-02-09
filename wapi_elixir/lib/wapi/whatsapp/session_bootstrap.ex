defmodule Wapi.WhatsApp.SessionBootstrap do
  @moduledoc """
  Starts sessions for WhatsApp accounts that were connected before server restart.
  Runs once at application startup.
  """
  require Logger
  import Ecto.Query

  def start do
    Logger.info("[SessionBootstrap] Checking for sessions to reconnect...")

    whatsapps =
      Wapi.Repo.all(
        from(w in Wapi.Schema.Whatsapp,
          where: w.enabled == true,
          select: %{id: w.id, connected: w.connected}
        )
      )

    # Also check for existing session directories
    session_dir = "whatsapp_sessions"

    session_ids =
      if File.dir?(session_dir) do
        case File.ls(session_dir) do
          {:ok, dirs} -> MapSet.new(dirs)
          {:error, _} -> MapSet.new()
        end
      else
        File.mkdir_p!(session_dir)
        MapSet.new()
      end

    # Start sessions that were connected OR have session files on disk
    to_start =
      Enum.filter(whatsapps, fn wa ->
        wa.connected || MapSet.member?(session_ids, wa.id)
      end)

    Logger.info("[SessionBootstrap] Starting #{length(to_start)} sessions")

    Enum.each(to_start, fn wa ->
      case Wapi.WhatsApp.SessionSupervisor.start_session(wa.id) do
        {:ok, _pid} ->
          Logger.info("[SessionBootstrap] Started session for #{wa.id}")

        {:error, reason} ->
          Logger.error("[SessionBootstrap] Failed to start #{wa.id}: #{inspect(reason)}")
      end
    end)

    Logger.info("[SessionBootstrap] Bootstrap complete")
  end
end
