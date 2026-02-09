defmodule WapiWeb.Router do
  use WapiWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug WapiWeb.Plugs.RateLimiter
  end

  # Health check (no rate limiting)
  scope "/", WapiWeb do
    get "/health", HealthController, :index
  end

  # API v1
  scope "/api/v1", WapiWeb do
    pipe_through :api

    # Sender endpoint
    post "/:whatsapp_slug/:connection_slug/sender", SenderController, :send

    # Session management
    post "/sessions/:whatsapp_id/connect", SessionController, :connect
    post "/sessions/:whatsapp_id/disconnect", SessionController, :disconnect
    post "/sessions/:whatsapp_id/reset", SessionController, :reset
    get "/sessions/:whatsapp_id/status", SessionController, :status
    get "/sessions", SessionController, :list
  end

  # Live Dashboard (dev only)
  if Application.compile_env(:wapi, :dev_routes) do
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]
      live_dashboard "/dashboard", metrics: Wapi.Telemetry
    end
  end
end
