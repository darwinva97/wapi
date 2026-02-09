import Config

# DATABASE_URL overrides dev.exs defaults for any environment
if database_url = System.get_env("DATABASE_URL") do
  config :wapi, Wapi.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    ssl: [verify: :verify_none],
    socket_options: if(System.get_env("IPV6") == "true", do: [:inet6], else: [])
end

if config_env() == :prod do
  unless System.get_env("DATABASE_URL") do
    raise "environment variable DATABASE_URL is missing."
  end

  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "localhost"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :wapi, WapiWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      ip: {0, 0, 0, 0, 0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base,
    server: true

  config :wapi, Wapi.WhatsApp.NodeBridge,
    node_path: System.get_env("NODE_PATH") || "node",
    bridge_script: System.get_env("BRIDGE_SCRIPT") || "priv/baileys-bridge/index.js"
end
