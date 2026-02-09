defmodule WapiWeb.HealthController do
  use WapiWeb, :controller

  def index(conn, _params) do
    active_sessions = Wapi.WhatsApp.SessionSupervisor.count_sessions()

    json(conn, %{
      status: "ok",
      timestamp: DateTime.utc_now(),
      active_sessions: active_sessions
    })
  end
end
