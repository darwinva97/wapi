import Config

config :wapi,
  ecto_repos: [Wapi.Repo],
  generators: [timestamp_type: :utc_datetime_usec]

config :wapi, WapiWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [
    formats: [json: WapiWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Wapi.PubSub,
  live_view: [signing_salt: "wapi_salt"]

config :wapi, Oban,
  repo: Wapi.Repo,
  queues: [
    default: 10,
    webhooks: 20,
    cleanup: 2,
    sync: 3,
    media: 5
  ],
  plugins: [
    {Oban.Plugins.Pruner, max_age: 7 * 24 * 60 * 60},
    {Oban.Plugins.Cron,
     crontab: [
       {"0 3 * * *", Wapi.Workers.CleanupWorker},
       {"0 * * * *", Wapi.Workers.OrphanSessionWorker}
     ]},
    Oban.Plugins.Lifeline
  ]

config :wapi, Wapi.WhatsApp.NodeBridge,
  node_path: "node",
  bridge_script: "priv/baileys-bridge/index.js"

config :wapi, sessions_dir: "whatsapp_sessions"

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :whatsapp_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
