defmodule Wapi.Workers.SyncWorker do
  @moduledoc """
  Oban worker that syncs WhatsApp connection states between
  the SessionServer processes and the database.
  Replaces the setInterval-based sync in whatsapp.ts.
  """
  use Oban.Worker,
    queue: :sync,
    max_attempts: 1,
    unique: [period: 25]

  require Logger
  import Ecto.Query

  @impl true
  def perform(_job) do
    whatsapps =
      Wapi.Repo.all(
        from(w in Wapi.Schema.Whatsapp, select: %{id: w.id, connected: w.connected})
      )

    for wa <- whatsapps do
      real_status =
        case Wapi.WhatsApp.SessionServer.get_status(wa.id) do
          :connected -> true
          _ -> false
        end

      if wa.connected != real_status do
        Logger.info("[Sync] Fixing mismatch for #{wa.id}: DB=#{wa.connected}, Real=#{real_status}")

        Wapi.Repo.update_all(
          from(w in Wapi.Schema.Whatsapp, where: w.id == ^wa.id),
          set: [connected: real_status]
        )
      end
    end

    :ok
  end
end
