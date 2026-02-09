defmodule Wapi.Workers.OrphanSessionWorker do
  @moduledoc """
  Oban cron worker that cleans up orphaned session directories.
  A session is orphaned if its directory exists but no corresponding
  WhatsApp record exists in the database.
  """
  use Oban.Worker,
    queue: :sync,
    max_attempts: 1

  require Logger
  import Ecto.Query

  @impl true
  def perform(_job) do
    Logger.info("[OrphanSession] Checking for orphan sessions")

    session_dir = Application.get_env(:wapi, :sessions_dir, "whatsapp_sessions")

    session_dirs =
      case File.ls(session_dir) do
        {:ok, dirs} -> MapSet.new(dirs)
        {:error, _} -> MapSet.new()
      end

    if MapSet.size(session_dirs) == 0 do
      :ok
    else
      valid_ids =
        Wapi.Repo.all(from(w in Wapi.Schema.Whatsapp, select: w.id))
        |> MapSet.new()

      orphans = MapSet.difference(session_dirs, valid_ids)

      Enum.each(orphans, fn orphan_id ->
        path = Path.join(session_dir, orphan_id)
        Logger.warning("[OrphanSession] Removing orphan session: #{orphan_id}")
        File.rm_rf!(path)
      end)

      if MapSet.size(orphans) > 0 do
        Logger.info("[OrphanSession] Removed #{MapSet.size(orphans)} orphan sessions")
      end

      :ok
    end
  end
end
