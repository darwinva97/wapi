defmodule Wapi.Application do
  @moduledoc false
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Telemetry
      Wapi.Telemetry,

      # Database
      Wapi.Repo,

      # PubSub
      {Phoenix.PubSub, name: Wapi.PubSub},

      # Rate limit storage
      {PlugAttack.Storage.Ets, name: Wapi.RateLimitStore, clean_period: 60_000},

      # Registry for SessionServers
      {Registry, keys: :unique, name: Wapi.WhatsApp.SessionRegistry},

      # DynamicSupervisor for WhatsApp sessions
      Wapi.WhatsApp.SessionSupervisor,

      # Node.js bridge (Baileys)
      Wapi.WhatsApp.NodeBridge,

      # Broadway message pipeline
      Wapi.Pipeline.MessagePipeline,

      # Oban job processing
      {Oban, Application.fetch_env!(:wapi, Oban)},

      # Phoenix Presence
      WapiWeb.Presence,

      # Phoenix Endpoint
      WapiWeb.Endpoint,

      # Bootstrap: reconnect active sessions (must be last)
      {Task.Supervisor, name: Wapi.TaskSupervisor},
      {Task, fn -> Wapi.WhatsApp.SessionBootstrap.start() end}
    ]

    opts = [strategy: :one_for_one, name: Wapi.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def config_change(changed, _new, removed) do
    WapiWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
