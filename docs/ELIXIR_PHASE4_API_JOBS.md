# Fase 4: API Sender + Jobs con Oban

## Objetivo

Migrar el endpoint Sender API a un Phoenix Controller con rate-limiting (PlugAttack), validacion con Ecto Changesets, y reemplazar los jobs manuales (cleanup, sync periodico) por workers Oban con scheduling, retry, y telemetria.

---

## Estado Actual

### Sender API (`src/app/api/[whatsapp_slug]/[connection_slug]/sender/route.ts`)

El endpoint actual realiza:

1. Validar Authorization header (Bearer token)
2. Buscar cuenta WhatsApp por slug
3. Buscar connection por slug
4. Verificar sender habilitado y token valido
5. Obtener socket Baileys
6. Parsear body (to + message)
7. Detectar tipo de mensaje y descargar media externa si hay
8. Enviar via Baileys `sock.sendMessage()`
9. Guardar en DB con tracking de origen

**Problemas:**
- Sin rate-limiting: un cliente puede enviar miles de mensajes sin control
- Sin validacion de formato de `to` (solo agrega `@s.whatsapp.net` si no tiene `@`)
- Sin cola: si Baileys esta lento, el request queda colgado
- Sin metricas: no se sabe cuantos mensajes se envian por conexion
- Timeout del request de Next.js puede cortar el envio

### Cleanup Job (`src/lib/cleanup-job.ts`)

- Se ejecuta manualmente via script (`npm run cleanup`)
- Procesamiento secuencial de todas las instancias
- Sin scheduling automatico
- Sin tracking de ejecuciones previas

### Sync Periodico (`src/lib/whatsapp.ts:1488-1509`)

```typescript
let syncInterval: ReturnType<typeof setInterval> | null = null;
export function startPeriodicSync(intervalMs: number = 30000): void {
  syncInterval = setInterval(() => {
    syncAllConnectionStates().catch(console.error);
  }, intervalMs);
}
```

- `setInterval` no es confiable para long-running tasks
- Si el servidor se reinicia, el intervalo se pierde
- Sin registro de ejecuciones ni errores
- Sin proteccion contra ejecuciones solapadas

---

## Sender API → Phoenix Controller

### Router

```elixir
# lib/wapi_web/router.ex
defmodule WapiWeb.Router do
  use WapiWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug WapiWeb.Plugs.RateLimiter
  end

  scope "/api/v1", WapiWeb do
    pipe_through :api

    # Sender endpoint
    post "/:whatsapp_slug/:connection_slug/sender", SenderController, :send
  end
end
```

### Rate Limiting con PlugAttack

```elixir
defmodule WapiWeb.Plugs.RateLimiter do
  use PlugAttack

  # Rate limit por token de conexion: 60 mensajes por minuto
  rule "sender by token", conn do
    case get_bearer_token(conn) do
      nil -> :pass
      token ->
        throttle(token,
          period: 60_000,       # 1 minuto
          limit: 60,            # 60 requests
          storage: {PlugAttack.Storage.Ets, Wapi.RateLimitStore}
        )
    end
  end

  # Rate limit por IP: 120 requests por minuto
  rule "sender by ip", conn do
    ip = to_string(:inet_parse.ntoa(conn.remote_ip))
    throttle(ip,
      period: 60_000,
      limit: 120,
      storage: {PlugAttack.Storage.Ets, Wapi.RateLimitStore}
    )
  end

  # Respuesta cuando se excede el rate limit
  def block_action(conn, _data, _opts) do
    conn
    |> Plug.Conn.put_resp_header("retry-after", "60")
    |> Plug.Conn.send_resp(429, Jason.encode!(%{
      error: "Rate limit exceeded",
      retry_after: 60
    }))
    |> Plug.Conn.halt()
  end

  defp get_bearer_token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end
end
```

### Sender Controller

```elixir
defmodule WapiWeb.SenderController do
  use WapiWeb, :controller

  alias Wapi.Sender
  alias Wapi.Sender.SendMessageParams

  action_fallback WapiWeb.FallbackController

  def send(conn, %{"whatsapp_slug" => wa_slug, "connection_slug" => conn_slug}) do
    token = get_bearer_token(conn)

    with {:ok, params} <- parse_and_validate(conn),
         {:ok, context} <- Sender.authorize(wa_slug, conn_slug, token),
         {:ok, result} <- Sender.send_message(context, params) do
      conn
      |> put_status(:ok)
      |> json(%{success: true, data: result})
    end
  end

  defp parse_and_validate(conn) do
    conn.body_params
    |> SendMessageParams.changeset()
    |> case do
      %{valid?: true} = changeset ->
        {:ok, Ecto.Changeset.apply_changes(changeset)}
      changeset ->
        {:error, changeset}
    end
  end

  defp get_bearer_token(conn) do
    case Plug.Conn.get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end
end
```

### Validacion con Ecto Changesets

```elixir
defmodule Wapi.Sender.SendMessageParams do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  embedded_schema do
    field :to, :string
    field :message, :map
  end

  def changeset(params) do
    %__MODULE__{}
    |> cast(params, [:to, :message])
    |> validate_required([:to, :message])
    |> validate_jid(:to)
    |> validate_message(:message)
  end

  defp validate_jid(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      cond do
        # Numero sin formato: "5491112345678"
        Regex.match?(~r/^\d{10,15}$/, value) ->
          []

        # JID completo: "5491112345678@s.whatsapp.net"
        Regex.match?(~r/^\d+@s\.whatsapp\.net$/, value) ->
          []

        # Grupo: "123456789@g.us"
        Regex.match?(~r/^\d+-\d+@g\.us$/, value) ->
          []

        true ->
          [{field, "formato invalido. Use un numero, JID o grupo valido"}]
      end
    end)
  end

  defp validate_message(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      valid_keys = ~w(text image video audio document sticker caption fileName mimetype ptt)
      has_content = Enum.any?(valid_keys, &Map.has_key?(value, &1))

      if has_content do
        []
      else
        [{field, "debe contener al menos uno de: text, image, video, audio, document, sticker"}]
      end
    end)
  end
end
```

### Modulo Sender (Logica de Negocio)

```elixir
defmodule Wapi.Sender do
  alias Wapi.Repo
  alias Wapi.Schema.{Whatsapp, Connection, Message}
  alias Wapi.WhatsApp.SessionServer

  @doc """
  Verifica autorizacion: busca WhatsApp por slug, connection por slug,
  valida que sender este habilitado y el token sea correcto.
  """
  def authorize(whatsapp_slug, connection_slug, token) do
    with {:ok, wa} <- find_whatsapp(whatsapp_slug),
         {:ok, conn} <- find_connection(connection_slug, wa.id),
         :ok <- verify_sender(conn, token) do
      {:ok, %{whatsapp: wa, connection: conn}}
    end
  end

  @doc """
  Envia un mensaje via Baileys y lo persiste en la DB.
  """
  def send_message(%{whatsapp: wa, connection: conn}, params) do
    jid = normalize_jid(params.to)

    # Verificar que la sesion esta conectada
    case SessionServer.get_status(wa.id) do
      :connected ->
        # Preparar mensaje (descargar media externa si hay)
        {:ok, processed} = prepare_message(params.message, wa.id)

        # Enviar via NodeBridge
        case Wapi.WhatsApp.NodeBridge.send_message(wa.id, jid, processed.baileys_message) do
          {:ok, result} ->
            # Persistir en DB
            save_sent_message(wa.id, conn.id, jid, result, processed)
            {:ok, result}

          {:error, reason} ->
            {:error, {:send_failed, reason}}
        end

      status ->
        {:error, {:not_connected, status}}
    end
  end

  defp find_whatsapp(slug) do
    case Repo.get_by(Whatsapp, slug: slug) do
      nil -> {:error, :whatsapp_not_found}
      wa -> {:ok, wa}
    end
  end

  defp find_connection(slug, whatsapp_id) do
    case Repo.get_by(Connection, slug: slug, whatsapp_id: whatsapp_id) do
      nil -> {:error, :connection_not_found}
      conn -> {:ok, conn}
    end
  end

  defp verify_sender(conn, token) do
    cond do
      !conn.sender_enabled -> {:error, :sender_disabled}
      conn.sender_token != token -> {:error, :invalid_token}
      true -> :ok
    end
  end

  defp normalize_jid(to) do
    if String.contains?(to, "@") do
      to
    else
      "#{to}@s.whatsapp.net"
    end
  end

  defp prepare_message(message, whatsapp_id) do
    # Detectar si hay media con URL externa
    media_type = detect_media_type(message)

    if media_type && message[media_type]["url"] do
      # Descargar y guardar media
      url = message[media_type]["url"]
      case download_external_media(url) do
        {:ok, buffer, mime_type} ->
          save_result = Wapi.Storage.save_file(buffer, "#{media_type}_#{System.os_time(:millisecond)}", mime_type, whatsapp_id)
          {:ok, %{
            baileys_message: Map.put(message, media_type, buffer) |> Map.put("mimetype", mime_type),
            local_media_url: save_result.url,
            media_metadata: %{mimetype: mime_type, size: byte_size(buffer)}
          }}
        {:error, _} ->
          {:ok, %{baileys_message: message, local_media_url: nil, media_metadata: nil}}
      end
    else
      {:ok, %{baileys_message: message, local_media_url: nil, media_metadata: nil}}
    end
  end

  defp detect_media_type(message) do
    Enum.find(~w(image video audio document sticker), &Map.has_key?(message, &1))
  end
end
```

---

## Jobs con Oban

### Configuracion

```elixir
# config/config.exs
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
    # Limpieza de jobs completados (mantener 7 dias)
    {Oban.Plugins.Pruner, max_age: 7 * 24 * 60 * 60},

    # Cron jobs
    {Oban.Plugins.Cron, crontab: [
      # Cleanup de media: cada dia a las 3:00 AM
      {"0 3 * * *", Wapi.Workers.CleanupWorker},

      # Sync de estados de conexion: cada 30 segundos
      {"*/30 * * * * *", Wapi.Workers.SyncWorker, args: %{type: "connection_state"}},

      # Limpieza de sesiones huerfanas: cada hora
      {"0 * * * *", Wapi.Workers.OrphanSessionWorker},
    ]},

    # Telemetria
    Oban.Plugins.Lifeline
  ]
```

### Cleanup Worker

Reemplazo de `src/lib/cleanup-job.ts`:

```elixir
defmodule Wapi.Workers.CleanupWorker do
  use Oban.Worker,
    queue: :cleanup,
    max_attempts: 3,
    unique: [period: 3600]  # Max 1 ejecucion por hora

  require Logger

  @impl true
  def perform(%Oban.Job{args: args}) do
    Logger.info("[Cleanup] Starting cleanup job")
    started_at = System.monotonic_time(:millisecond)

    # Obtener configuracion de storage
    storage_config = Wapi.Storage.get_config()
    is_local = storage_config.storage_type == :local

    # Obtener todas las instancias con cleanup habilitado
    cleanup_configs = Wapi.Repo.all(
      from c in Wapi.Schema.WhatsappCleanupConfig,
        where: c.cleanup_enabled == true
    )

    Logger.info("[Cleanup] Processing #{length(cleanup_configs)} instances")

    results =
      Enum.map(cleanup_configs, fn config ->
        cleanup_instance(config, is_local)
      end)

    total_files = Enum.sum(Enum.map(results, & &1.files_deleted))
    total_bytes = Enum.sum(Enum.map(results, & &1.bytes_freed))
    duration_ms = System.monotonic_time(:millisecond) - started_at

    Logger.info(
      "[Cleanup] Completed in #{duration_ms}ms. " <>
      "Files: #{total_files}, Bytes: #{total_bytes}"
    )

    # Emitir telemetria
    :telemetry.execute(
      [:wapi, :cleanup, :completed],
      %{duration_ms: duration_ms, files_deleted: total_files, bytes_freed: total_bytes},
      %{instances: length(cleanup_configs)}
    )

    :ok
  end

  defp cleanup_instance(config, is_local) do
    cutoff = DateTime.add(DateTime.utc_now(), -config.cleanup_days, :day)

    # Obtener mensajes con media antiguos
    messages = get_expired_media_messages(config, cutoff)

    Logger.info("[Cleanup] Found #{length(messages)} messages to clean for #{config.whatsapp_id}")

    Enum.reduce(messages, %{files_deleted: 0, bytes_freed: 0, errors: []}, fn msg, acc ->
      case delete_media(msg, is_local) do
        {:ok, bytes} ->
          # Actualizar mensaje para remover referencia a media
          Wapi.Repo.update_message_media(msg.id, nil, nil)
          %{acc | files_deleted: acc.files_deleted + 1, bytes_freed: acc.bytes_freed + bytes}

        {:error, reason} ->
          %{acc | errors: [reason | acc.errors]}
      end
    end)
  end

  defp get_expired_media_messages(config, cutoff) do
    query =
      from m in Wapi.Schema.Message,
        where: m.whatsapp_id == ^config.whatsapp_id,
        where: m.timestamp < ^cutoff,
        where: not is_nil(m.media_url)

    # Agregar filtro de retencion (a menos que sea force cleanup)
    query =
      if config.force_cleanup do
        query
      else
        from m in query,
          where: is_nil(m.media_retention_until) or m.media_retention_until < ^DateTime.utc_now()
      end

    # Aplicar filtros de chat
    query = apply_chat_filters(query, config)

    Wapi.Repo.all(query)
  end

  defp apply_chat_filters(query, config) do
    # Obtener chat configs
    chat_configs = Wapi.Repo.all(
      from c in Wapi.Schema.ChatConfig,
        where: c.whatsapp_id == ^config.whatsapp_id
    )

    excluded = MapSet.new(
      (config.exclude_chats || []) ++
      Enum.filter(chat_configs, & &1.cleanup_excluded) |> Enum.map(& &1.chat_id)
    )

    if MapSet.size(excluded) > 0 do
      excluded_list = MapSet.to_list(excluded)
      from m in query, where: m.chat_id not in ^excluded_list
    else
      query
    end
  end
end
```

### Sync Worker

Reemplazo de `setInterval` en `src/lib/whatsapp.ts:1488-1509`:

```elixir
defmodule Wapi.Workers.SyncWorker do
  use Oban.Worker,
    queue: :sync,
    max_attempts: 1,
    unique: [period: 25]  # Evitar solapamiento (corre cada 30s)

  require Logger

  @impl true
  def perform(%Oban.Job{args: %{"type" => "connection_state"}}) do
    Logger.debug("[Sync] Syncing connection states")

    # Obtener todas las cuentas WhatsApp
    whatsapps = Wapi.Repo.all(Wapi.Schema.Whatsapp)

    for wa <- whatsapps do
      # Obtener estado real del SessionServer
      real_status =
        case Wapi.WhatsApp.SessionServer.get_status(wa.id) do
          :connected -> true
          _ -> false
        end

      # Comparar con DB
      if wa.connected != real_status do
        Logger.info("[Sync] Fixing state mismatch for #{wa.id}: DB=#{wa.connected}, Real=#{real_status}")
        Wapi.Repo.update(Ecto.Changeset.change(wa, connected: real_status))
      end
    end

    :ok
  end
end
```

### Orphan Session Worker

```elixir
defmodule Wapi.Workers.OrphanSessionWorker do
  use Oban.Worker,
    queue: :sync,
    max_attempts: 1

  require Logger

  @impl true
  def perform(_job) do
    Logger.info("[OrphanSession] Checking for orphan sessions")

    # Obtener sesiones activas en el supervisor
    active_sessions =
      Wapi.WhatsApp.SessionSupervisor.list_sessions()
      |> Enum.map(fn {id, _pid} -> id end)
      |> MapSet.new()

    # Obtener directorios de sesion en disco
    session_dirs =
      case File.ls("whatsapp_sessions") do
        {:ok, dirs} -> MapSet.new(dirs)
        {:error, _} -> MapSet.new()
      end

    # Obtener IDs validos de la DB
    valid_ids =
      Wapi.Repo.all(from w in Wapi.Schema.Whatsapp, select: w.id)
      |> MapSet.new()

    # Sesiones en disco sin cuenta en DB (huerfanas)
    orphans = MapSet.difference(session_dirs, valid_ids)

    Enum.each(orphans, fn orphan_id ->
      Logger.warning("[OrphanSession] Removing orphan session: #{orphan_id}")
      File.rm_rf!(Path.join("whatsapp_sessions", orphan_id))
    end)

    if MapSet.size(orphans) > 0 do
      Logger.info("[OrphanSession] Removed #{MapSet.size(orphans)} orphan sessions")
    end

    :ok
  end
end
```

---

## Telemetria y Metricas

### Eventos de Telemetria

```elixir
defmodule Wapi.Telemetry do
  def attach do
    :telemetry.attach_many(
      "wapi-metrics",
      [
        [:wapi, :sender, :message_sent],
        [:wapi, :sender, :message_failed],
        [:wapi, :cleanup, :completed],
        [:wapi, :webhook, :delivered],
        [:wapi, :webhook, :failed],
        [:wapi, :session, :connected],
        [:wapi, :session, :disconnected],
      ],
      &handle_event/4,
      nil
    )
  end

  defp handle_event(event, measurements, metadata, _config) do
    # Log estructurado
    Logger.info("#{inspect(event)}", Map.merge(measurements, metadata))

    # Aqui se puede integrar con Prometheus, StatsD, etc.
  end
end
```

### Metricas del Sender

```elixir
# En el SenderController, despues de enviar:
:telemetry.execute(
  [:wapi, :sender, :message_sent],
  %{duration_ms: duration_ms},
  %{
    whatsapp_id: wa.id,
    connection_id: conn.id,
    message_type: params.message_type
  }
)
```

---

## Comparativa: API/Jobs Actual vs. Propuesto

| Aspecto | Actual (Next.js) | Propuesto (Phoenix + Oban) |
|---------|-----------------|--------------------------|
| Rate limiting | No existe | PlugAttack: 60 req/min por token |
| Validacion | Basica (`!to \|\| !message`) | Ecto Changesets con reglas de formato |
| Cleanup scheduling | Manual (`npm run cleanup`) | Oban Cron: 3:00 AM diario |
| Sync periodico | `setInterval` (pierde al reiniciar) | Oban Cron: cada 30s, persistente |
| Retry de jobs | No existe | Oban: configurable por worker |
| Observabilidad | `console.log` | Telemetry + Oban dashboard |
| Ejecuciones solapadas | Posible | Oban `unique` previene |
| Historial de ejecuciones | No existe | Oban persiste en PostgreSQL |

---

## Criterios de Exito

- [ ] Sender API migrado a Phoenix Controller
- [ ] Rate limiting: 60 msg/min por token, 120 req/min por IP
- [ ] Validacion de JID con regex
- [ ] Validacion de contenido del mensaje
- [ ] Cleanup job en Oban Cron (diario 3:00 AM)
- [ ] Sync periodico en Oban Cron (cada 30s)
- [ ] Limpieza de sesiones huerfanas (cada hora)
- [ ] Telemetria para metricas de envio y jobs
- [ ] Sin ejecuciones solapadas de jobs
