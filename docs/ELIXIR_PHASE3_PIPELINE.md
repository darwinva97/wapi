# Fase 3: Pipeline de Procesamiento de Mensajes con Broadway

## Objetivo

Descomponer el handler monolitico `messages.upsert` (~480 lineas en `src/lib/whatsapp.ts:646-1125`) en un pipeline Broadway con etapas bien definidas: ingesta, procesamiento, descarga de media, persistencia, y dispatch de webhooks/eventos.

---

## Problemas Actuales

### 1. Handler Monolitico (`src/lib/whatsapp.ts:646-1125`)

El handler `messages.upsert` realiza **todo** secuencialmente en un solo bloque:

```
messages.upsert handler (~480 lineas)
├── Para cada mensaje:
│   ├── Extraer receiver/sender/context (linea 654)
│   ├── Calcular timestamp (lineas 669-676)
│   ├── Procesar reacciones (lineas 681-737)
│   ├── Procesar votos de polls (lineas 739-789)
│   ├── Procesar creacion de polls (lineas 791-797)
│   ├── Extraer texto del mensaje (linea 799)
│   ├── Verificar/crear contacto del sender (lineas 804-939) ← ~135 lineas
│   ├── Detectar tipo de mensaje (lineas 942-946)
│   ├── Manejar ubicacion (lineas 953-958)
│   ├── Descargar y guardar media (lineas 960-998) ← BLOQUEANTE
│   ├── Insertar mensaje en DB (lineas 1006-1026)
│   ├── Crear poll si aplica (lineas 1029-1052)
│   └── Emitir evento SSE (lineas 1055-1066)
├── Dispatch webhooks (lineas 1088-1124) ← Sin retry, sin timeout
└── Error handling: try/catch global + session corruption check
```

**Problemas:**
- Procesamiento secuencial: un mensaje lento bloquea todos los siguientes
- Descarga de media bloquea el loop completo
- Webhooks sin retry ni timeout
- Un error en un mensaje puede perder los mensajes siguientes del batch
- No hay backpressure: si llegan 1000 mensajes, se procesan todos o ninguno
- Imposible escalar el procesamiento horizontalmente

### 2. Descarga de Media Bloqueante (lineas 960-998)

```typescript
const buffer = await downloadMediaFromMessage(messageContent, messageType);
if (buffer) {
  const saveResult = await downloadAndSaveMedia(buffer, ...);
  mediaUrl = saveResult.url;
}
```

- `downloadContentFromMessage` lee un stream completo en memoria
- Si la descarga tarda (media grande, red lenta), bloquea todo
- No hay timeout en la descarga
- No hay limite de descargas concurrentes

### 3. Webhooks Sin Garantias (lineas 1088-1124)

```typescript
for (const connection of connections) {
  try {
    await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...config.headers },
      body: JSON.stringify(m),
    });
  } catch (err) {
    console.error(`Error sending webhook...`, err);
  }
}
```

- Sin retry: si falla, el webhook se pierde
- Sin timeout: un webhook lento bloquea los siguientes
- Sin dead letter queue: no hay registro de webhooks fallidos
- Secuencial: un webhook por vez

---

## Diseno del Pipeline Broadway

### Arquitectura del Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Broadway Pipeline                             │
│                                                                 │
│  ┌──────────────┐                                               │
│  │   Producer    │  ← Recibe eventos del NodeBridge             │
│  │  (GenStage)   │     via Wapi.Pipeline.MessageProducer        │
│  └──────┬───────┘                                               │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────┐       │
│  │            Processors (N concurrentes)                │       │
│  │                                                      │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │       │
│  │  │Worker 1  │ │Worker 2  │ │Worker 3  │ ...         │       │
│  │  │          │ │          │ │          │             │       │
│  │  │- Parse   │ │- Parse   │ │- Parse   │             │       │
│  │  │- Validate│ │- Validate│ │- Validate│             │       │
│  │  │- Enrich  │ │- Enrich  │ │- Enrich  │             │       │
│  │  └──────────┘ └──────────┘ └──────────┘             │       │
│  └──────────────────────┬───────────────────────────────┘       │
│                         │                                       │
│            ┌────────────┼────────────┐                          │
│            ▼            ▼            ▼                          │
│  ┌──────────────┐ ┌──────────┐ ┌──────────────┐               │
│  │  DB Batcher   │ │  Media   │ │  Webhook     │               │
│  │               │ │  Batcher │ │  Batcher     │               │
│  │  - Batch      │ │          │ │              │               │
│  │    insert     │ │  - Download│ │  - Dispatch │               │
│  │  - Upsert     │ │  - Save  │ │  - Retry    │               │
│  │    contacts   │ │  - Update│ │  - DLQ      │               │
│  └──────────────┘ └──────────┘ └──────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Configuracion Broadway

```elixir
defmodule Wapi.Pipeline.MessagePipeline do
  use Broadway

  alias Broadway.Message

  def start_link(_opts) do
    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: [
        module: {Wapi.Pipeline.MessageProducer, []},
        concurrency: 1
      ],
      processors: [
        default: [
          concurrency: 10,   # 10 workers concurrentes
          max_demand: 5       # Cada worker procesa hasta 5 mensajes
        ]
      ],
      batchers: [
        database: [
          concurrency: 3,
          batch_size: 50,
          batch_timeout: 500  # ms
        ],
        media: [
          concurrency: 5,     # 5 descargas de media concurrentes
          batch_size: 10,
          batch_timeout: 1_000
        ],
        webhook: [
          concurrency: 3,
          batch_size: 20,
          batch_timeout: 500
        ],
        realtime: [
          concurrency: 2,
          batch_size: 100,
          batch_timeout: 100  # Baja latencia para realtime
        ]
      ]
    )
  end

  ## Processor: parsea, valida y enriquece cada mensaje

  @impl true
  def handle_message(_processor, %Message{data: raw_data} = message, _context) do
    case parse_and_enrich(raw_data) do
      {:ok, parsed} ->
        message
        |> Message.update_data(fn _ -> parsed end)
        |> determine_batchers(parsed)

      {:skip, reason} ->
        Message.failed(message, reason)

      {:error, reason} ->
        Message.failed(message, reason)
    end
  end

  ## Batcher: database - inserta mensajes en batch

  @impl true
  def handle_batch(:database, messages, _batch_info, _context) do
    # Insertar todos los mensajes del batch en una sola transaccion
    entries =
      Enum.map(messages, fn %Message{data: data} ->
        %{
          id: data.message_id,
          whatsapp_id: data.whatsapp_id,
          chat_id: data.chat_id,
          chat_type: data.chat_type,
          sender_id: data.sender_id,
          content: data.raw_content,
          body: data.body,
          timestamp: data.timestamp,
          from_me: data.from_me,
          message_type: data.message_type,
          ack_status: data.ack_status
        }
      end)

    case Wapi.Repo.insert_all(Wapi.Schema.Message, entries,
           on_conflict: :nothing,
           returning: false) do
      {count, _} ->
        Logger.info("[Pipeline:DB] Inserted #{count} messages in batch")
        messages

      {:error, reason} ->
        Logger.error("[Pipeline:DB] Batch insert failed: #{inspect(reason)}")
        Enum.map(messages, &Message.failed(&1, reason))
    end
  end

  ## Batcher: media - descarga y guarda archivos media

  @impl true
  def handle_batch(:media, messages, _batch_info, _context) do
    # Procesar cada media en paralelo dentro del batch
    tasks =
      Enum.map(messages, fn %Message{data: data} = msg ->
        Task.async(fn ->
          case download_and_save_media(data) do
            {:ok, media_url, metadata} ->
              # Actualizar el mensaje en DB con la URL del media
              Wapi.Repo.update_message_media(data.message_id, media_url, metadata)
              msg

            {:error, reason} ->
              Logger.warning("[Pipeline:Media] Failed to download: #{inspect(reason)}")
              # No falla el mensaje completo, solo el media
              msg
          end
        end)
      end)

    Task.await_many(tasks, 30_000)
  end

  ## Batcher: webhook - dispatch a URLs configuradas

  @impl true
  def handle_batch(:webhook, messages, _batch_info, _context) do
    Enum.map(messages, fn %Message{data: data} = msg ->
      # Crear un job Oban para cada webhook (con retry y DLQ)
      data.webhook_connections
      |> Enum.each(fn connection ->
        %{
          whatsapp_id: data.whatsapp_id,
          connection_id: connection.id,
          url: connection.receiver_url,
          headers: connection.receiver_headers,
          payload: data.webhook_payload
        }
        |> Wapi.Workers.WebhookWorker.new(max_attempts: 5)
        |> Oban.insert()
      end)

      msg
    end)
  end

  ## Batcher: realtime - emite eventos a Phoenix PubSub

  @impl true
  def handle_batch(:realtime, messages, _batch_info, _context) do
    Enum.each(messages, fn %Message{data: data} ->
      # Broadcast a todos los clientes suscritos al chat
      Phoenix.PubSub.broadcast(Wapi.PubSub, "chat:#{data.chat_id}", %{
        event: "new_message",
        payload: %{
          id: data.message_id,
          body: data.body,
          timestamp: data.timestamp,
          from_me: data.from_me,
          sender_id: data.sender_id,
          message_type: data.message_type,
          ack_status: data.ack_status
        }
      })
    end)

    messages
  end

  ## Funciones privadas

  defp parse_and_enrich(raw_data) do
    with {:ok, msg} <- parse_message(raw_data),
         {:ok, enriched} <- enrich_contact(msg),
         {:ok, classified} <- classify_message(enriched) do
      {:ok, classified}
    end
  end

  defp parse_message(%{"whatsapp_id" => wid, "messages" => msgs, "type" => type}) do
    parsed =
      Enum.map(msgs, fn msg ->
        %{
          whatsapp_id: wid,
          message_id: get_in(msg, ["key", "id"]),
          chat_id: get_in(msg, ["key", "remoteJid"]),
          from_me: get_in(msg, ["key", "fromMe"]) || false,
          sender_id: get_in(msg, ["key", "participant"]) || get_in(msg, ["key", "remoteJid"]),
          raw_content: msg,
          body: extract_message_text(msg["message"]),
          timestamp: parse_timestamp(msg["messageTimestamp"]),
          type: type,
          message_type: detect_type(msg["message"]),
          push_name: msg["pushName"]
        }
      end)

    {:ok, parsed}
  end

  defp determine_batchers(message, parsed) do
    batchers = [:database, :realtime]

    # Agregar media batcher si tiene media
    batchers =
      if parsed.message_type in ~w(image video audio sticker document) do
        [:media | batchers]
      else
        batchers
      end

    # Agregar webhook batcher si hay connections con receiver
    batchers =
      if parsed.type == "notify" do
        [:webhook | batchers]
      else
        batchers
      end

    Enum.reduce(batchers, message, &Message.put_batcher(&2, &1))
  end
end
```

### Producer (GenStage)

```elixir
defmodule Wapi.Pipeline.MessageProducer do
  use GenStage

  def start_link(_opts) do
    GenStage.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @doc """
  Envia un mensaje al pipeline para ser procesado.
  Llamado desde el NodeBridge cuando llega un messages.upsert.
  """
  def push(whatsapp_id, data) do
    GenStage.cast(__MODULE__, {:push, whatsapp_id, data})
  end

  @impl true
  def init(:ok) do
    {:producer, %{queue: :queue.new(), demand: 0}}
  end

  @impl true
  def handle_cast({:push, whatsapp_id, data}, %{queue: queue, demand: demand} = state) do
    event = %{whatsapp_id: whatsapp_id, data: data, received_at: System.monotonic_time()}
    queue = :queue.in(event, queue)
    dispatch_events(%{state | queue: queue}, [])
  end

  @impl true
  def handle_demand(incoming_demand, %{demand: demand} = state) do
    dispatch_events(%{state | demand: demand + incoming_demand}, [])
  end

  defp dispatch_events(%{queue: queue, demand: demand} = state, events) when demand > 0 do
    case :queue.out(queue) do
      {{:value, event}, queue} ->
        dispatch_events(
          %{state | queue: queue, demand: demand - 1},
          [event | events]
        )

      {:empty, _queue} ->
        {:noreply, Enum.reverse(events), state}
    end
  end

  defp dispatch_events(state, events) do
    {:noreply, Enum.reverse(events), state}
  end
end
```

---

## Workers Paralelos para Descarga de Media

### Configuracion de Concurrencia

```
Actual (Node.js):
  1 mensaje → descarga media → guarda → siguiente mensaje
  [====download====][====save====][====download====][====save====]
  Total: 4 * T

Propuesto (Broadway):
  Worker 1: [====download====][====save====]
  Worker 2: [====download====][====save====]
  Worker 3: [====download====][====save====]
  Worker 4: [====download====][====save====]
  Worker 5: [====download====][====save====]
  Total: ~T (5x mas rapido)
```

### Media Worker con Timeout

```elixir
defp download_and_save_media(data) do
  # Solicitar descarga al NodeBridge con timeout
  case Wapi.WhatsApp.NodeBridge.download_media(
    data.whatsapp_id,
    data.raw_content,
    data.message_type,
    timeout: 30_000  # 30s timeout por media
  ) do
    {:ok, buffer} ->
      # Guardar en storage (local o S3)
      filename = generate_filename(data.message_type, data.message_id)
      Wapi.Storage.save_file(buffer, filename, data.mimetype, data.whatsapp_id)

    {:error, :timeout} ->
      Logger.warning("[Media] Download timeout for #{data.message_id}")
      {:error, :timeout}

    {:error, reason} ->
      {:error, reason}
  end
end
```

---

## Cola de Webhooks con Retry y Dead Letter Queue

### Oban Worker para Webhooks

```elixir
defmodule Wapi.Workers.WebhookWorker do
  use Oban.Worker,
    queue: :webhooks,
    max_attempts: 5,
    priority: 1

  @impl true
  def perform(%Oban.Job{args: args, attempt: attempt}) do
    %{
      "url" => url,
      "headers" => headers,
      "payload" => payload,
      "connection_id" => connection_id
    } = args

    case send_webhook(url, headers, payload) do
      {:ok, %{status: status}} when status in 200..299 ->
        Logger.info("[Webhook] Delivered to #{url} (status: #{status})")
        :ok

      {:ok, %{status: status}} when status in 400..499 ->
        # Error del cliente, no reintentar (excepto 429)
        if status == 429 do
          # Rate limited - reintentar con backoff
          {:snooze, backoff_seconds(attempt)}
        else
          Logger.warning("[Webhook] Client error #{status} for #{url}, not retrying")
          :ok  # No reintentar errores 4xx
        end

      {:ok, %{status: status}} ->
        Logger.warning("[Webhook] Server error #{status} for #{url}, attempt #{attempt}")
        {:error, "HTTP #{status}"}

      {:error, %Req.TransportError{reason: reason}} ->
        Logger.warning("[Webhook] Transport error: #{reason}, attempt #{attempt}")
        {:error, reason}
    end
  end

  # Backoff exponencial: 10s, 30s, 60s, 120s, 300s
  defp backoff_seconds(attempt) do
    min(10 * :math.pow(3, attempt - 1) |> round(), 300)
  end

  defp send_webhook(url, headers, payload) do
    Req.post(url,
      json: payload,
      headers: Map.merge(%{"content-type" => "application/json"}, headers || %{}),
      receive_timeout: 10_000,   # 10s timeout
      retry: false               # Oban maneja los retries
    )
  end
end
```

### Dead Letter Queue

Los webhooks que fallan despues de 5 intentos se registran automaticamente por Oban:

```elixir
# Consultar webhooks fallidos
def list_failed_webhooks(whatsapp_id, limit \\ 50) do
  Oban.Job
  |> where([j], j.queue == "webhooks")
  |> where([j], j.state == "discarded")
  |> where([j], fragment("?->>'whatsapp_id' = ?", j.args, ^whatsapp_id))
  |> order_by([j], desc: j.attempted_at)
  |> limit(^limit)
  |> Wapi.Repo.all()
end

# Reintentar un webhook fallido
def retry_failed_webhook(job_id) do
  Oban.retry_job(job_id)
end

# Reintentar todos los fallidos de una conexion
def retry_all_failed(connection_id) do
  Oban.Job
  |> where([j], j.state == "discarded")
  |> where([j], fragment("?->>'connection_id' = ?", j.args, ^connection_id))
  |> Wapi.Repo.all()
  |> Enum.each(&Oban.retry_job(&1.id))
end
```

---

## Backpressure y Manejo de Rafagas

### Problema Actual

Cuando llegan muchos mensajes simultaneamente (por ejemplo, al reconectar una sesion con historial pendiente), Node.js procesa todo secuencialmente sin control:

```typescript
// Actual: todos los mensajes se procesan sin limite
sock.ev.on("messages.upsert", async (m) => {
  for (const msg of m.messages) {  // ← Sin limite de concurrencia
    // ... proceso completo por mensaje
  }
});
```

### Solucion Broadway

Broadway implementa backpressure automatico via GenStage:

```
Velocidad de ingesta:  ████████████████████  (1000 msg/s)
                              │
                    ┌─────────┴──────────┐
                    │   Producer Queue    │  ← Buffer automatico
                    │   (max_demand: 5)   │
                    └─────────┬──────────┘
                              │
                    Backpressure: solo entrega 5 a cada worker
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         [Worker 1]      [Worker 2]      [Worker 3]
         5 msgs          5 msgs          5 msgs
              │               │               │
              ▼               ▼               ▼
         [Batcher]  ← Batch de 50, timeout 500ms
              │
              ▼
         INSERT ALL  ← Una query para 50 registros
```

### Configuracion de Backpressure

```elixir
# En la configuracion de Broadway:
processors: [
  default: [
    concurrency: 10,    # Maximo 10 workers concurrentes
    max_demand: 5        # Cada worker pide max 5 mensajes
  ]
],
batchers: [
  database: [
    batch_size: 50,      # Batch de hasta 50 mensajes
    batch_timeout: 500   # O flush cada 500ms (lo que ocurra primero)
  ]
]

# Resultado: max 10 * 5 = 50 mensajes en vuelo a la vez
# Si llegan mas, se acumulan en el producer queue
```

---

## Procesamiento de Tipos Especiales

### Reacciones

Actualmente en `src/lib/whatsapp.ts:681-737`. En Broadway:

```elixir
defp classify_message(%{raw_content: %{"message" => %{"reactionMessage" => reaction}}} = msg) do
  {:ok, %{msg |
    message_type: :reaction,
    reaction_target: get_in(reaction, ["key", "id"]),
    reaction_emoji: reaction["text"],
    batchers: [:reaction_db]  # Batcher especifico para reacciones
  }}
end
```

### Polls

Actualmente en `src/lib/whatsapp.ts:739-797`. En Broadway:

```elixir
defp classify_message(%{raw_content: %{"message" => %{"pollCreationMessage" => poll}}} = msg) do
  {:ok, %{msg |
    message_type: :poll_creation,
    poll_question: poll["name"],
    poll_options: Enum.map(poll["options"] || [], & &1["optionName"]),
    batchers: [:database, :realtime]
  }}
end

defp classify_message(%{raw_content: %{"message" => %{"pollUpdateMessage" => vote}}} = msg) do
  {:ok, %{msg |
    message_type: :poll_vote,
    poll_target: get_in(vote, ["pollCreationMessageKey", "id"]),
    batchers: [:poll_vote_db]
  }}
end
```

---

## Comparativa: Procesamiento Actual vs. Propuesto

| Aspecto | Actual (Node.js) | Propuesto (Broadway) |
|---------|-----------------|---------------------|
| Concurrencia | 1 mensaje a la vez | 10+ workers paralelos |
| Descarga media | Bloqueante, secuencial | 5 workers paralelos, con timeout |
| Batch insert | 1 INSERT por mensaje | Batch de 50 en 1 query |
| Webhooks | Sin retry, sin timeout | Oban: 5 retries, backoff, DLQ |
| Backpressure | No existe | GenStage automatico |
| Error isolation | try/catch global | Cada mensaje es independiente |
| Observabilidad | console.log | Telemetry metrics + Broadway dashboard |
| Throughput estimado | ~50 msg/s | ~500+ msg/s |

---

## Criterios de Exito

- [ ] Handler monolitico descompuesto en Producer + Processors + Batchers
- [ ] Procesamiento de mensajes en paralelo (10+ workers)
- [ ] Descarga de media no bloquea procesamiento de otros mensajes
- [ ] Batch inserts en DB (50 mensajes por query)
- [ ] Webhooks con retry (5 intentos) y dead letter queue
- [ ] Backpressure automatico ante rafagas de mensajes
- [ ] Telemetria para monitorear throughput y latencia del pipeline
- [ ] Reacciones, polls, y mensajes de texto procesados correctamente
