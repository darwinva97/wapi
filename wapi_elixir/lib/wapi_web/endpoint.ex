defmodule WapiWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :wapi

  @session_options [
    store: :cookie,
    key: "_wapi_key",
    signing_salt: "wapi_sign",
    same_site: "Lax"
  ]

  socket "/socket", WapiWeb.UserSocket,
    websocket: [timeout: 45_000],
    longpoll: false

  socket "/live", Phoenix.LiveView.Socket,
    websocket: [connect_info: [session: @session_options]]

  # Serve static files (for media)
  plug Plug.Static,
    at: "/",
    from: :wapi,
    gzip: false,
    only: ~w(media assets)

  if code_reloading? do
    plug Phoenix.CodeReloader
  end

  plug Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options

  plug CORSPlug,
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    headers: ["Authorization", "Content-Type"]

  plug WapiWeb.Router

  def static_paths, do: ~w(media assets)
end
