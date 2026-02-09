import Config

# DB config is set via DATABASE_URL in runtime.exs
# Fallback for local postgres (override with DATABASE_URL env var):
config :wapi, Wapi.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "wapi_dev",
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :wapi, WapiWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_only_secret_key_base_at_least_64_characters_long_for_development_use",
  watchers: []

config :logger, :console, format: "[$level] $message\n"
config :phoenix, :stacktrace_depth, 20
config :phoenix, :plug_init_mode, :runtime
