# Estructura del Proyecto Elixir/Phoenix

## Objetivo

Definir la estructura de directorios, configuracion de `mix.exs`, dependencias, variables de entorno, y estrategia de Docker/deployment para el proyecto Elixir que sera el backend de WAPI.

---

## Arbol de Directorios

```
wapi_elixir/
├── config/
│   ├── config.exs            # Configuracion base compartida
│   ├── dev.exs               # Configuracion de desarrollo
│   ├── prod.exs              # Configuracion de produccion
│   ├── test.exs              # Configuracion de tests
│   └── runtime.exs           # Configuracion de runtime (vars de entorno)
│
├── lib/
│   ├── wapi/                  # Logica de negocio (contextos)
│   │   ├── application.ex     # Application supervisor (entry point)
│   │   │
│   │   ├── whatsapp/          # Contexto: Gestion de sesiones WhatsApp
│   │   │   ├── session_server.ex      # GenServer por sesion
│   │   │   ├── session_supervisor.ex  # DynamicSupervisor
│   │   │   ├── session_registry.ex    # Registry para lookup
│   │   │   ├── session_bootstrap.ex   # Reconexion al arranque
│   │   │   └── node_bridge.ex         # Port/comunicacion con Node.js
│   │   │
│   │   ├── pipeline/          # Contexto: Pipeline de mensajes (Broadway)
│   │   │   ├── message_pipeline.ex    # Broadway pipeline principal
│   │   │   ├── message_producer.ex    # GenStage producer
│   │   │   ├── message_parser.ex      # Parsing y clasificacion
│   │   │   └── media_downloader.ex    # Descarga de media
│   │   │
│   │   ├── sender/            # Contexto: Envio de mensajes
│   │   │   ├── sender.ex             # Logica de envio
│   │   │   └── send_message_params.ex # Changeset de validacion
│   │   │
│   │   ├── workers/           # Oban workers
│   │   │   ├── webhook_worker.ex      # Dispatch de webhooks
│   │   │   ├── cleanup_worker.ex      # Limpieza de media
│   │   │   ├── sync_worker.ex         # Sync de estados
│   │   │   └── orphan_session_worker.ex # Limpieza de sesiones
│   │   │
│   │   ├── schema/            # Ecto schemas
│   │   │   ├── user.ex
│   │   │   ├── session.ex
│   │   │   ├── account.ex
│   │   │   ├── whatsapp.ex
│   │   │   ├── contact.ex
│   │   │   ├── group.ex
│   │   │   ├── connection.ex
│   │   │   ├── message.ex
│   │   │   ├── reaction.ex
│   │   │   ├── poll.ex
│   │   │   ├── poll_vote.ex
│   │   │   ├── platform_config.ex
│   │   │   ├── user_config.ex
│   │   │   ├── whatsapp_member.ex
│   │   │   ├── whatsapp_cleanup_config.ex
│   │   │   ├── chat_config.ex
│   │   │   ├── chat_note.ex
│   │   │   └── storage_config.ex
│   │   │
│   │   ├── storage/           # Abstraccion de almacenamiento
│   │   │   ├── storage.ex            # API publica
│   │   │   ├── local_storage.ex      # Almacenamiento local
│   │   │   └── s3_storage.ex         # Almacenamiento S3/B2
│   │   │
│   │   ├── authorization.ex   # Logica de autorizacion
│   │   ├── repo.ex            # Ecto Repo
│   │   └── telemetry.ex       # Setup de telemetria
│   │
│   └── wapi_web/              # Capa web (Phoenix)
│       ├── endpoint.ex        # Phoenix.Endpoint
│       ├── router.ex          # Rutas HTTP y WebSocket
│       ├── telemetry.ex       # Telemetria web
│       │
│       ├── channels/          # Phoenix Channels (realtime)
│       │   ├── user_socket.ex        # Socket para frontend
│       │   ├── chat_channel.ex       # Channel por chat
│       │   ├── qr_channel.ex         # Channel para QR
│       │   ├── session_channel.ex    # Channel estado de sesion
│       │   └── presence.ex           # Phoenix.Presence
│       │
│       ├── controllers/       # REST API controllers
│       │   ├── sender_controller.ex  # POST /api/v1/:wa/:conn/sender
│       │   ├── health_controller.ex  # GET /health
│       │   └── fallback_controller.ex # Error handling
│       │
│       ├── plugs/             # Plugs personalizados
│       │   ├── rate_limiter.ex       # PlugAttack rate limiting
│       │   └── api_auth.ex           # Autenticacion de API
│       │
│       └── views/             # JSON views
│           ├── error_view.ex
│           └── sender_view.ex
│
├── priv/
│   ├── repo/
│   │   └── migrations/       # Migraciones Ecto
│   │       ├── 20240101000000_create_users.exs
│   │       ├── 20240101000001_create_whatsapps.exs
│   │       └── ...
│   │
│   └── baileys-bridge/       # Sidecar Node.js para Baileys
│       ├── package.json
│       ├── index.js           # Entry point del bridge
│       ├── session-manager.js # Gestion de sesiones Baileys
│       └── event-mapper.js    # Mapeo de eventos Baileys → JSON
│
├── test/
│   ├── wapi/
│   │   ├── whatsapp/
│   │   │   ├── session_server_test.exs
│   │   │   └── node_bridge_test.exs
│   │   ├── pipeline/
│   │   │   ├── message_pipeline_test.exs
│   │   │   └── message_parser_test.exs
│   │   ├── sender/
│   │   │   └── sender_test.exs
│   │   └── workers/
│   │       ├── webhook_worker_test.exs
│   │       └── cleanup_worker_test.exs
│   ├── wapi_web/
│   │   ├── channels/
│   │   │   └── chat_channel_test.exs
│   │   └── controllers/
│   │       └── sender_controller_test.exs
│   ├── support/
│   │   ├── conn_case.ex
│   │   ├── channel_case.ex
│   │   └── fixtures.ex
│   └── test_helper.exs
│
├── mix.exs                    # Definicion del proyecto
├── mix.lock                   # Lockfile de dependencias
├── .formatter.exs             # Configuracion del formatter
├── .credo.exs                 # Configuracion de Credo (linter)
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Compose para desarrollo
├── fly.toml                   # (Opcional) Fly.io deployment
└── README.md
```

---

## Configuracion de `mix.exs`

```elixir
defmodule Wapi.MixProject do
  use Mix.Project

  def project do
    [
      app: :wapi,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      dialyzer: [
        plt_add_apps: [:mix, :ex_unit],
        plt_file: {:no_warn, "priv/plts/project.plt"}
      ]
    ]
  end

  def application do
    [
      mod: {Wapi.Application, []},
      extra_applications: [:logger, :runtime_tools, :observer]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Web framework
      {:phoenix, "~> 1.7.18"},
      {:phoenix_pubsub, "~> 2.1"},
      {:phoenix_live_dashboard, "~> 0.8"},
      {:plug_cowboy, "~> 2.7"},
      {:cors_plug, "~> 3.0"},

      # Database
      {:ecto_sql, "~> 3.12"},
      {:postgrex, "~> 0.19"},

      # Job processing
      {:oban, "~> 2.18"},

      # Data pipeline
      {:broadway, "~> 1.1"},

      # Rate limiting
      {:plug_attack, "~> 0.4"},

      # JSON
      {:jason, "~> 1.4"},

      # HTTP client (para webhooks y media download)
      {:req, "~> 0.5"},

      # Telemetria
      {:telemetry, "~> 1.3"},
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.1"},

      # Dev & Test
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false},
      {:ex_machina, "~> 2.8", only: :test},
      {:mox, "~> 1.2", only: :test},

      # Observabilidad (opcional)
      {:phoenix_live_view, "~> 1.0"},  # Para Live Dashboard
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"],
    ]
  end
end
```

---

## Application Supervisor

```elixir
defmodule Wapi.Application do
  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Telemetria
      WapiWeb.Telemetry,

      # Database
      Wapi.Repo,

      # PubSub distribuido
      {Phoenix.PubSub, name: Wapi.PubSub},

      # Rate limit storage
      {PlugAttack.Storage.Ets, name: Wapi.RateLimitStore, clean_period: 60_000},

      # Registry para SessionServers
      {Registry, keys: :unique, name: Wapi.WhatsApp.SessionRegistry},

      # Supervisor dinamico para sesiones WhatsApp
      Wapi.WhatsApp.SessionSupervisor,

      # Bridge con Node.js (Baileys)
      Wapi.WhatsApp.NodeBridge,

      # Pipeline Broadway
      Wapi.Pipeline.MessagePipeline,

      # Oban (job processing)
      {Oban, Application.fetch_env!(:wapi, Oban)},

      # Presence
      WapiWeb.Presence,

      # Phoenix endpoint (HTTP + WebSocket)
      WapiWeb.Endpoint,

      # Bootstrap: reconectar sesiones activas (debe ser ultimo)
      {Task, fn -> Wapi.WhatsApp.SessionBootstrap.start() end},
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
```

---

## Variables de Entorno

### `config/runtime.exs`

```elixir
import Config

if config_env() == :prod do
  # Database
  database_url =
    System.get_env("DATABASE_URL") ||
      raise "DATABASE_URL environment variable is missing"

  config :wapi, Wapi.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "20"),
    ssl: System.get_env("DATABASE_SSL") == "true"

  # Phoenix
  host = System.get_env("PHX_HOST") || "localhost"
  port = String.to_integer(System.get_env("PORT") || "4000")
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise "SECRET_KEY_BASE environment variable is missing"

  config :wapi, WapiWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [port: port],
    secret_key_base: secret_key_base,
    server: true

  # Node.js bridge
  config :wapi, Wapi.WhatsApp.NodeBridge,
    node_path: System.get_env("NODE_PATH") || "node",
    bridge_script: System.get_env("BRIDGE_SCRIPT") || "priv/baileys-bridge/index.js"

  # Storage S3 (opcional, se lee de la DB pero se puede override)
  if System.get_env("S3_ENDPOINT") do
    config :wapi, :s3_override,
      endpoint: System.get_env("S3_ENDPOINT"),
      bucket: System.get_env("S3_BUCKET"),
      region: System.get_env("S3_REGION") || "auto",
      access_key: System.get_env("S3_ACCESS_KEY"),
      secret_key: System.get_env("S3_SECRET_KEY"),
      public_url: System.get_env("S3_PUBLIC_URL")
  end
end
```

### Variables de Entorno Completas

| Variable | Requerida | Default | Descripcion |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | Si | - | URL de conexion PostgreSQL |
| `SECRET_KEY_BASE` | Si (prod) | - | Clave secreta para Phoenix (64+ chars) |
| `PORT` | No | `4000` | Puerto HTTP del servidor |
| `PHX_HOST` | No | `localhost` | Hostname para URLs |
| `POOL_SIZE` | No | `20` | Tamano del pool de conexiones DB |
| `DATABASE_SSL` | No | `false` | Habilitar SSL para DB |
| `NODE_PATH` | No | `node` | Ruta al binario de Node.js |
| `BRIDGE_SCRIPT` | No | `priv/baileys-bridge/index.js` | Ruta al script del bridge |
| `S3_ENDPOINT` | No | - | Endpoint S3 (override de DB config) |
| `S3_BUCKET` | No | - | Bucket S3 |
| `S3_REGION` | No | `auto` | Region S3 |
| `S3_ACCESS_KEY` | No | - | Access key S3 |
| `S3_SECRET_KEY` | No | - | Secret key S3 |
| `S3_PUBLIC_URL` | No | - | URL publica del bucket |
| `MIX_ENV` | No | `dev` | Entorno (dev/test/prod) |

---

## Docker

### Dockerfile (Multi-stage)

```dockerfile
# ============================================
# Stage 1: Build Elixir release
# ============================================
FROM elixir:1.17-otp-27-alpine AS elixir-builder

RUN apk add --no-cache build-base git

WORKDIR /app

# Instalar hex y rebar
RUN mix local.hex --force && mix local.rebar --force

# Copiar archivos de dependencias
ENV MIX_ENV=prod
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mix deps.compile

# Copiar codigo fuente y compilar
COPY config config
COPY lib lib
COPY priv/repo priv/repo
RUN mix compile
RUN mix release

# ============================================
# Stage 2: Build Node.js bridge
# ============================================
FROM node:22-alpine AS node-builder

WORKDIR /app/baileys-bridge

COPY priv/baileys-bridge/package.json priv/baileys-bridge/package-lock.json* ./
RUN npm ci --production

COPY priv/baileys-bridge/ ./

# ============================================
# Stage 3: Runtime
# ============================================
FROM alpine:3.20 AS runtime

RUN apk add --no-cache \
  libstdc++ \
  openssl \
  ncurses-libs \
  nodejs \
  npm

WORKDIR /app

# Copiar release de Elixir
COPY --from=elixir-builder /app/_build/prod/rel/wapi ./

# Copiar bridge de Node.js
COPY --from=node-builder /app/baileys-bridge ./priv/baileys-bridge/

# Crear directorio para sesiones WhatsApp
RUN mkdir -p /app/whatsapp_sessions && \
    mkdir -p /app/public/media

# Variables de entorno
ENV MIX_ENV=prod
ENV PORT=4000

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["bin/wapi", "start"]
```

### docker-compose.yml (Desarrollo)

```yaml
version: "3.8"

services:
  # Elixir backend
  wapi-elixir:
    build:
      context: ./wapi_elixir
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/wapi_dev
      - SECRET_KEY_BASE=dev-secret-key-at-least-64-characters-long-for-development-only
      - PORT=4000
      - PHX_HOST=localhost
      - MIX_ENV=prod
    volumes:
      - whatsapp_sessions:/app/whatsapp_sessions
      - media_files:/app/public/media
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  # Next.js frontend (existente)
  wapi-next:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/wapi_dev
      - NEXT_PUBLIC_WS_URL=ws://localhost:4000/socket
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  # PostgreSQL
  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=wapi_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  whatsapp_sessions:
  media_files:
```

---

## Deployment

### Opcion A: Docker Compose (VPS)

```bash
# Build y deploy
docker compose build
docker compose up -d

# Ejecutar migraciones
docker compose exec wapi-elixir bin/wapi eval "Wapi.Release.migrate()"

# Ver logs
docker compose logs -f wapi-elixir

# Acceder a consola IEx remota
docker compose exec wapi-elixir bin/wapi remote
```

### Opcion B: Fly.io

```toml
# fly.toml
app = "wapi-elixir"
primary_region = "gru"  # Sao Paulo

[build]
  dockerfile = "Dockerfile"

[env]
  PORT = "4000"
  PHX_HOST = "wapi-elixir.fly.dev"

[http_service]
  internal_port = 4000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 800

[[vm]]
  memory = "1gb"
  cpu_kind = "shared"
  cpus = 2

[mounts]
  source = "whatsapp_sessions"
  destination = "/app/whatsapp_sessions"
```

```bash
# Deploy en Fly.io
fly launch
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set SECRET_KEY_BASE="$(mix phx.gen.secret)"
fly deploy

# Migraciones
fly ssh console -C "/app/bin/wapi eval 'Wapi.Release.migrate()'"

# Consola IEx remota
fly ssh console -C "/app/bin/wapi remote"
```

### Opcion C: Release Nativa (sin Docker)

```bash
# Compilar release
MIX_ENV=prod mix deps.get
MIX_ENV=prod mix compile
MIX_ENV=prod mix release

# Ejecutar
DATABASE_URL="..." SECRET_KEY_BASE="..." _build/prod/rel/wapi/bin/wapi start

# O como servicio systemd
# /etc/systemd/system/wapi.service
```

---

## Release Module

```elixir
defmodule Wapi.Release do
  @moduledoc """
  Funciones para ejecutar en el contexto del release (migraciones, seeds).
  """

  @app :wapi

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.load(@app)
  end
end
```

---

## Criterios de Exito

- [ ] Proyecto generado con `mix phx.new wapi --no-html --no-assets`
- [ ] Todas las dependencias definidas en `mix.exs`
- [ ] Application supervisor con orden correcto de children
- [ ] Variables de entorno documentadas y configuradas en `runtime.exs`
- [ ] Dockerfile multi-stage funcional (Elixir + Node.js)
- [ ] docker-compose.yml con Elixir + Next.js + PostgreSQL
- [ ] Health check endpoint en `/health`
- [ ] Release module con `migrate/0` y `rollback/2`
- [ ] Consola IEx remota accesible en produccion
