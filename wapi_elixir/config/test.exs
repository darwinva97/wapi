import Config

config :wapi, Wapi.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "wapi_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: System.schedulers_online() * 2

config :wapi, WapiWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test_only_secret_key_base_at_least_64_characters_long_for_test_use_only",
  server: false

config :wapi, Oban, testing: :inline

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime
