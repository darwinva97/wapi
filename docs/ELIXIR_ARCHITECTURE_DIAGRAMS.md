# Diagramas de Arquitectura

## 1. Arquitectura Hibrida (Next.js Frontend ↔ Elixir Backend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTES                                       │
│                                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │ Browser (UI) │  │ Browser (UI) │  │ API Client   │  │ API Client   │  │
│   │ Agente 1     │  │ Agente 2     │  │ (Webhook)    │  │ (Sender)     │  │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│          │                 │                  │                 │           │
└──────────┼─────────────────┼──────────────────┼─────────────────┼───────────┘
           │                 │                  │                 │
    HTTPS  │          WebSocket               HTTPS              │ HTTPS
    :3000  │          :4000/socket             :4000           :4000
           │                 │                  │                 │
           ▼                 ▼                  ▼                 ▼
┌──────────────────┐  ┌──────────────────────────────────────────────────────┐
│                  │  │                                                      │
│   NEXT.JS 16     │  │               ELIXIR/OTP (Phoenix 1.7)              │
│   :3000          │  │               :4000                                  │
│                  │  │                                                      │
│  ┌────────────┐  │  │  ┌───────────────┐  ┌────────────────────────────┐  │
│  │ React 19   │  │  │  │ Phoenix       │  │ Phoenix Channels           │  │
│  │ App Router │  │  │  │ Router        │  │                            │  │
│  │ Pages      │  │  │  │               │  │  chat:{chatId}            │  │
│  │ Layouts    │  │  │  │ POST /sender  │  │  qr:{waId}               │  │
│  │ Components │  │  │  │ GET /health   │  │  session:{waId}          │  │
│  └────────────┘  │  │  └───────┬───────┘  │  presence:{waId}         │  │
│                  │  │          │           └──────────┬─────────────────┘  │
│  ┌────────────┐  │  │          │                      │                    │
│  │ better-auth│  │  │          ▼                      ▼                    │
│  │ Sessions   │  │  │  ┌──────────────────────────────────────────────┐    │
│  │ Accounts   │  │  │  │              Phoenix.PubSub                  │    │
│  └────────────┘  │  │  │         (Distribuido en cluster)             │    │
│                  │  │  └──────────────────┬───────────────────────────┘    │
│  ┌────────────┐  │  │                     │                                │
│  │ Radix UI   │  │  │     ┌───────────────┼────────────────┐              │
│  │ Tailwind   │  │  │     │               │                │              │
│  │ Recharts   │  │  │     ▼               ▼                ▼              │
│  └────────────┘  │  │  ┌────────┐  ┌────────────┐  ┌────────────────┐    │
│                  │  │  │Sessions│  │  Broadway   │  │  Oban          │    │
│                  │  │  │Servers │  │  Pipeline   │  │  Jobs          │    │
│                  │  │  │(Gen)   │  │             │  │                │    │
│                  │  │  └───┬────┘  └──────┬─────┘  └───────┬────────┘    │
│                  │  │      │              │                 │              │
│                  │  │      └──────────────┼─────────────────┘              │
│                  │  │                     │                                │
│                  │  │                     ▼                                │
│                  │  │           ┌──────────────────┐                       │
│                  │  │           │   Node.js Sidecar │                       │
│                  │  │           │   (Baileys 7.0)   │                       │
│                  │  │           │   via Erlang Port  │                       │
│                  │  │           └────────┬─────────┘                       │
│                  │  │                    │                                  │
└────────┬─────────┘  └────────────────────┼──────────────────────────────────┘
         │                                 │
         │                                 │  WebSocket (WA Protocol)
         │                                 ▼
         │                        ┌──────────────────┐
         │                        │  Servidores       │
         │                        │  WhatsApp         │
         │                        └──────────────────┘
         │
         │    Ambos leen/escriben la misma DB
         │
         ▼
┌──────────────────┐
│   PostgreSQL 16   │
│                  │
│  ┌────────────┐  │
│  │ whatsapp   │  │
│  │ contact    │  │
│  │ group      │  │
│  │ message    │  │
│  │ connection │  │
│  │ reaction   │  │
│  │ poll       │  │
│  │ user       │  │
│  │ session    │  │
│  │ oban_jobs  │  │
│  └────────────┘  │
└──────────────────┘
```

---

## 2. Supervision Tree Completo

```
Wapi.Supervisor (:one_for_one)
│
├── WapiWeb.Telemetry
│   └── (telemetry poller y metricas)
│
├── Wapi.Repo
│   └── (Postgrex connection pool - 20 conexiones)
│
├── Phoenix.PubSub (name: Wapi.PubSub)
│   └── (PG2 adapter para distribucion en cluster)
│
├── PlugAttack.Storage.Ets (name: Wapi.RateLimitStore)
│   └── (ETS table para rate limiting, cleanup cada 60s)
│
├── Registry (name: Wapi.WhatsApp.SessionRegistry)
│   └── (Registro :unique para lookup de SessionServers)
│
├── Wapi.WhatsApp.SessionSupervisor (:one_for_one, DynamicSupervisor)
│   │
│   ├── Wapi.WhatsApp.SessionServer "whatsapp-id-abc"
│   │   └── Estado: %{status: :connected, retry_count: 0, ...}
│   │
│   ├── Wapi.WhatsApp.SessionServer "whatsapp-id-def"
│   │   └── Estado: %{status: :qr_pending, qr_code: "...", ...}
│   │
│   ├── Wapi.WhatsApp.SessionServer "whatsapp-id-ghi"
│   │   └── Estado: %{status: :connecting, retry_count: 2, ...}
│   │
│   └── ... (N procesos, uno por cuenta WhatsApp activa)
│
├── Wapi.WhatsApp.NodeBridge (GenServer)
│   └── Puerto Erlang → node priv/baileys-bridge/index.js
│       └── N sesiones Baileys corriendo dentro del proceso Node.js
│
├── Wapi.Pipeline.MessagePipeline (Broadway)
│   ├── Producer (1 proceso)
│   │   └── Cola interna (:queue)
│   ├── Processors (10 procesos)
│   │   ├── processor_1
│   │   ├── processor_2
│   │   └── ... processor_10
│   └── Batchers
│       ├── :database (3 procesos, batch_size: 50)
│       ├── :media (5 procesos, batch_size: 10)
│       ├── :webhook (3 procesos, batch_size: 20)
│       └── :realtime (2 procesos, batch_size: 100)
│
├── Oban (Supervisor)
│   ├── Oban.Notifier (PostgreSQL LISTEN/NOTIFY)
│   ├── Oban.Registry
│   ├── Oban.Queue.Default (10 workers)
│   ├── Oban.Queue.Webhooks (20 workers)
│   ├── Oban.Queue.Cleanup (2 workers)
│   ├── Oban.Queue.Sync (3 workers)
│   ├── Oban.Queue.Media (5 workers)
│   └── Oban.Plugins
│       ├── Oban.Plugins.Pruner (limpieza de jobs viejos)
│       ├── Oban.Plugins.Cron (scheduling)
│       └── Oban.Plugins.Lifeline (rescate de jobs stuck)
│
├── WapiWeb.Presence (Phoenix.Presence)
│   └── (CRDT para tracking distribuido de agentes)
│
├── WapiWeb.Endpoint
│   ├── Plug pipeline (HTTP)
│   │   ├── Plug.Logger
│   │   ├── Plug.Parsers
│   │   ├── WapiWeb.Router
│   │   │   ├── /api/v1/:wa/:conn/sender → SenderController
│   │   │   └── /health → HealthController
│   │   └── WapiWeb.Plugs.RateLimiter
│   └── WebSocket transport
│       └── WapiWeb.UserSocket
│           ├── ChatChannel "chat:*"
│           ├── QrChannel "qr:*"
│           └── SessionChannel "session:*"
│
└── Task (SessionBootstrap)
    └── (Reconecta sesiones activas al arranque, luego termina)
```

---

## 3. Pipeline Broadway (Detallado)

```
                    Eventos del NodeBridge
                    (messages.upsert)
                           │
                           ▼
              ┌─────────────────────────┐
              │     MessageProducer      │
              │     (GenStage)           │
              │                         │
              │  ┌───────────────────┐  │
              │  │  :queue (buffer)  │  │
              │  │  demand: N        │  │
              │  └───────────────────┘  │
              └────────────┬────────────┘
                           │
                   demand-driven
              (max_demand: 5 por worker)
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │Processor 1│    │Processor 2│    │Processor N│    (concurrency: 10)
   │           │    │           │    │           │
   │ 1. Parse  │    │ 1. Parse  │    │ 1. Parse  │
   │    JSON   │    │    JSON   │    │    JSON   │
   │           │    │           │    │           │
   │ 2. Classify│   │ 2. Classify│   │ 2. Classify│
   │    - text │    │    - image│    │    - react.│
   │    - image│    │    - video│    │    - poll  │
   │    - etc  │    │    - etc  │    │    - etc   │
   │           │    │           │    │           │
   │ 3. Enrich │    │ 3. Enrich │    │ 3. Enrich │
   │    - contact│  │    - contact│  │    - contact│
   │    - group│    │    - group│    │    - group │
   │           │    │           │    │           │
   │ 4. Route  │    │ 4. Route  │    │ 4. Route  │
   │    batchers│   │    batchers│   │    batchers│
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
              Routing a batchers por tipo
                           │
         ┌─────────┬───────┼────────┬──────────┐
         │         │       │        │          │
         ▼         ▼       ▼        ▼          ▼
   ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐
   │ :database│ │:media│ │:media│ │:web- │ │:real-  │
   │ batcher  │ │batch1│ │batch2│ │hook  │ │time    │
   │          │ │      │ │      │ │      │ │        │
   │ Batch 50 │ │Batch │ │Batch │ │Batch │ │Batch   │
   │ mensajes │ │10 med│ │10 med│ │20 wh │ │100 evt │
   │          │ │      │ │      │ │      │ │        │
   │ INSERT   │ │Down- │ │Down- │ │Oban  │ │PubSub  │
   │ ALL      │ │load  │ │load  │ │insert│ │broad-  │
   │ (1 query)│ │+Save │ │+Save │ │jobs  │ │cast    │
   └────┬─────┘ └──┬───┘ └──┬───┘ └──┬───┘ └───┬────┘
        │          │        │        │          │
        ▼          ▼        ▼        ▼          ▼
   PostgreSQL   Storage   Storage   oban_jobs   Phoenix
                (Local/   (Local/   (tabla)     PubSub →
                 S3)       S3)                  Channels →
                                                Clientes
```

---

## 4. Flujo de un Mensaje Entrante (End-to-End)

```
Telefono del           Servidores          Node.js           Elixir/OTP
contacto               WhatsApp           Sidecar
   │                      │                  │                   │
   │  Mensaje WA          │                  │                   │
   │─────────────────────►│                  │                   │
   │                      │  Push via WS     │                   │
   │                      │─────────────────►│                   │
   │                      │                  │                   │
   │                      │                  │  Descifra         │
   │                      │                  │  (Signal Protocol)│
   │                      │                  │                   │
   │                      │                  │  messages.upsert  │
   │                      │                  │  {JSON event}     │
   │                      │                  │──────────────────►│
   │                      │                  │  (via Port/stdin) │
   │                      │                  │                   │
   │                      │                  │          NodeBridge recibe
   │                      │                  │          dispatch_event()
   │                      │                  │                   │
   │                      │                  │          ┌────────┴────────┐
   │                      │                  │          │                 │
   │                      │                  │          ▼                 │
   │                      │                  │   SessionServer     MessageProducer
   │                      │                  │   (actualiza        push(wid, data)
   │                      │                  │    last_activity)         │
   │                      │                  │                           │
   │                      │                  │                    Broadway Pipeline
   │                      │                  │                           │
   │                      │                  │                    ┌──────┼──────┐
   │                      │                  │                    │      │      │
   │                      │                  │                    ▼      ▼      ▼
   │                      │                  │               Processor: Parse + Classify
   │                      │                  │                    │
   │                      │                  │              ┌─────┼─────┬──────┐
   │                      │                  │              │     │     │      │
   │                      │                  │              ▼     ▼     ▼      ▼
   │                      │                  │           :db   :media :wh  :realtime
   │                      │                  │              │     │     │      │
   │                      │                  │              │     │     │      │
   │                      │                  │     INSERT   │  Download │   PubSub
   │                      │                  │     ALL      │  + Save  │   broadcast
   │                      │                  │              │     │     │      │
   │                      │                  │              ▼     │     │      ▼
   │                      │                  │         PostgreSQL │     │   ChatChannel
   │                      │                  │              │     │     │      │
   │                      │                  │              │     ▼     │      │
   │                      │                  │              │  Storage  │      │
   │                      │                  │              │  (S3/local)│     │
   │                      │                  │              │     │     ▼      │
   │                      │                  │              │     │   Oban    │
   │                      │                  │              │     │   Job     │
   │                      │                  │              │     │     │     │
   │                      │                  │              │     │     ▼     ▼
   │                      │                  │              │     │  Webhook  Browser
   │                      │                  │              │     │  POST     (agente)
   │                      │                  │              │     │     │      │
   │                      │                  │              ▼     ▼     ▼      ▼
   │                      │                  │            [Mensaje visible en UI]
   │                      │                  │            [Media descargado]
   │                      │                  │            [Webhook entregado]
```

---

## 5. Flujo de Conexion/Reconexion de Sesion WhatsApp

```
Usuario               Next.js          Elixir              Node.js         WhatsApp
(Browser)             Frontend         Backend             Sidecar         Servers
   │                    │                │                    │               │
   │ Click "Conectar"  │                │                    │               │
   │───────────────────►│                │                    │               │
   │                    │                │                    │               │
   │                    │  Join "qr:{id}"│                    │               │
   │                    │───────────────►│                    │               │
   │                    │  (WebSocket)   │                    │               │
   │                    │                │                    │               │
   │                    │ HTTP POST      │                    │               │
   │                    │ /connect/{id}  │                    │               │
   │                    │───────────────►│                    │               │
   │                    │                │                    │               │
   │                    │                │  SessionSupervisor │               │
   │                    │                │  start_session(id) │               │
   │                    │                │        │           │               │
   │                    │                │        ▼           │               │
   │                    │                │  SessionServer     │               │
   │                    │                │  init(id)          │               │
   │                    │                │  status: :connecting               │
   │                    │                │        │           │               │
   │                    │                │        │ NodeBridge│               │
   │                    │                │        │ connect() │               │
   │                    │                │        │──────────►│               │
   │                    │                │        │           │  makeWASocket │
   │                    │                │        │           │──────────────►│
   │                    │                │        │           │               │
   │                    │                │        │           │  QR Code      │
   │                    │                │        │           │◄──────────────│
   │                    │                │        │           │               │
   │                    │                │        │  {qr: "..."}             │
   │                    │                │        │◄──────────│               │
   │                    │                │        │           │               │
   │                    │                │  SessionServer     │               │
   │                    │                │  handle_info({:qr})│               │
   │                    │                │  status: :qr_pending              │
   │                    │                │        │           │               │
   │                    │                │  PubSub.broadcast  │               │
   │                    │                │  "qr:{id}"         │               │
   │                    │                │        │           │               │
   │                    │  push "qr_update"       │           │               │
   │                    │◄───────────────│        │           │               │
   │  Mostrar QR       │                │        │           │               │
   │◄───────────────────│                │        │           │               │
   │                    │                │        │           │               │
   │  [Escanea QR]     │                │        │           │               │
   │                    │                │        │           │  Auth OK      │
   │                    │                │        │           │◄──────────────│
   │                    │                │        │           │               │
   │                    │                │        │ {connection.open}         │
   │                    │                │        │◄──────────│               │
   │                    │                │        │           │               │
   │                    │                │  SessionServer     │               │
   │                    │                │  handle_info(:connection_open)     │
   │                    │                │  status: :connected│               │
   │                    │                │  retry_count: 0    │               │
   │                    │                │        │           │               │
   │                    │                │  DB: connected=true│               │
   │                    │                │  PubSub: "session:{id}"           │
   │                    │                │        │           │               │
   │                    │  push "connected"       │           │               │
   │                    │◄───────────────│        │           │               │
   │  "Conectado!"     │                │        │           │               │
   │◄───────────────────│                │        │           │               │
   │                    │                │        │           │               │
   │                    │                │        │           │               │
   ═══════════════════════════════════════════════════════════════════════════
   │                    DESCONEXION / RECONEXION               │               │
   │                    │                │        │           │               │
   │                    │                │        │  {connection.close,       │
   │                    │                │        │   reason: :unknown}       │
   │                    │                │        │◄──────────│               │
   │                    │                │        │           │               │
   │                    │                │  SessionServer     │               │
   │                    │                │  handle_info({:connection_closed}) │
   │                    │                │  status: :disconnected             │
   │                    │                │  retry_count: 1    │               │
   │                    │                │        │           │               │
   │                    │                │  schedule_retry()  │               │
   │                    │                │  (1s backoff)      │               │
   │                    │                │        │           │               │
   │                    │  push "status_change"   │           │               │
   │                    │  {status: "reconnecting"}           │               │
   │                    │◄───────────────│        │           │               │
   │                    │                │        │           │               │
   │                    │                │  [1 segundo]       │               │
   │                    │                │        │           │               │
   │                    │                │  handle_info(:retry_connect)       │
   │                    │                │  do_connect()      │               │
   │                    │                │        │──────────►│               │
   │                    │                │        │           │──────────────►│
   │                    │                │        │           │               │
   │                    │                │        │           │  Reconnected  │
   │                    │                │        │           │◄──────────────│
   │                    │                │        │           │               │
   │                    │                │  status: :connected│               │
   │                    │                │  retry_count: 0    │               │
   │                    │                │  backoff: reset    │               │
   │                    │                │        │           │               │
   │                    │  push "status_change"   │           │               │
   │                    │  {status: "connected"}  │           │               │
   │                    │◄───────────────│        │           │               │
   │  "Reconectado"    │                │        │           │               │
   │◄───────────────────│                │        │           │               │
   │                    │                │        │           │               │
   ═══════════════════════════════════════════════════════════════════════════
   │                    CORRUPCION DE SESION (Bad MAC)         │               │
   │                    │                │        │           │               │
   │                    │                │        │  {connection.close,       │
   │                    │                │        │   reason: :session_corrupted}
   │                    │                │        │◄──────────│               │
   │                    │                │        │           │               │
   │                    │                │  SessionServer     │               │
   │                    │                │  1. clear_session() │              │
   │                    │                │     rm -rf session/ │              │
   │                    │                │  2. schedule_retry() │             │
   │                    │                │  3. PubSub: session_error          │
   │                    │                │        │           │               │
   │                    │  push "status_change"   │           │               │
   │                    │  {status: "session_error",          │               │
   │                    │   message: "Bad MAC..."}│           │               │
   │                    │◄───────────────│        │           │               │
   │  "Escanee QR      │                │        │           │               │
   │   nuevamente"     │                │        │           │               │
   │◄───────────────────│                │        │           │               │
   │                    │                │        │           │               │
   │                    │                │  [retry → new QR]  │               │
   │                    │                │  (ciclo se repite) │               │
```

---

## 6. Backoff Exponencial (Detalle)

```
Intentos de Reconexion
                                                    ┌── Max 60s ──┐
                                                    │             │
Delay   │                                      ┌────┤  ████████   │
(seg)   │                                 ┌────┤    │  ████████   │
   60   │                            ┌────┤    │    │  ████████   │
        │                       ┌────┤    │    │    │             │
   32   │                  ┌────┤    │    │    │    │             │
        │             ┌────┤    │    │    │    │    │             │
   16   │        ┌────┤    │    │    │    │    │    │             │
        │   ┌────┤    │    │    │    │    │    │    │             │
    8   │   │    │    │    │    │    │    │    │    │             │
        ├───┤    │    │    │    │    │    │    │    │             │
    4   │   │    │    │    │    │    │    │    │    │             │
    2   ├───┤    │    │    │    │    │    │    │    │             │
    1   ├───┤    │    │    │    │    │    │    │    │  Max retries│
        └───┴────┴────┴────┴────┴────┴────┴────┴────┴─────────────┘
        R1   R2   R3   R4   R5   R6   R7   R8   R9  R10 → STOP

        Actual (Node.js):  ├─2s─┤─3s─┤─2s─┤─3s─┤─2s─┤ ... (forever)
        Propuesto (Elixir): ├1s┤─2s─┤──4s──┤───8s───┤──16s──┤ → STOP at R10
```

---

## 7. Comparativa de Procesos: Actual vs. Propuesto

```
ACTUAL (Node.js - Single Process)
═══════════════════════════════════

   ┌─────────────────────────────────────────────────────┐
   │              Node.js Process (PID 1)                 │
   │                                                     │
   │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
   │  │ Session 1│ │ Session 2│ │ Session 3│  (Map)      │
   │  └──────────┘ └──────────┘ └──────────┘            │
   │                                                     │
   │  ┌─────────────────────────────────────┐            │
   │  │ EventEmitter (max 100 listeners)    │            │
   │  │ - SSE clients                       │            │
   │  │ - QR listeners                      │            │
   │  │ - Status listeners                  │            │
   │  └─────────────────────────────────────┘            │
   │                                                     │
   │  Event Loop ──────────────────────────────────►     │
   │  (todo secuencial en el mismo thread)               │
   │                                                     │
   │  Si CUALQUIER cosa falla → TODO se afecta          │
   └─────────────────────────────────────────────────────┘


PROPUESTO (Elixir/OTP - Proceso por Entidad)
═══════════════════════════════════════════════

   ┌───────────────────────────────────────────────────────────────┐
   │                    BEAM VM (Erlang VM)                         │
   │                                                               │
   │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
   │  │Sess 1│ │Sess 2│ │Sess 3│ │Proc 1│ │Proc 2│ │Proc N│     │
   │  │ Gen  │ │ Gen  │ │ Gen  │ │Broad.│ │Broad.│ │Broad.│     │
   │  │Server│ │Server│ │Server│ │Worker│ │Worker│ │Worker│     │
   │  └──┬───┘ └──┬───┘ └──┬───┘ └──────┘ └──────┘ └──────┘     │
   │     │        │        │                                       │
   │  ┌──┴────────┴────────┴──┐                                    │
   │  │   DynamicSupervisor    │  Si Session 2 crashea:           │
   │  │   (reinicia hijos)     │  → Solo Session 2 se reinicia    │
   │  └────────────────────────┘  → Session 1 y 3 no se afectan  │
   │                                                               │
   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
   │  │Channel │ │Channel │ │Channel │ │Oban   │ │PubSub  │    │
   │  │Chat 1  │ │Chat 2  │ │QR scan │ │Worker │ │(global)│    │
   │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │
   │                                                               │
   │  Schedulers: ═══════╗ ═══════╗ ═══════╗ ═══════╗            │
   │  (N CPU cores)      ║        ║        ║        ║            │
   │  Todos los procesos comparten los schedulers                  │
   │  Pre-emptive: ningun proceso puede bloquear a otros          │
   └───────────────────────────────────────────────────────────────┘
```

---

## 8. Flujo de Datos en la Base de Datos Compartida

```
┌───────────────┐                           ┌───────────────┐
│   Next.js      │                           │   Elixir       │
│   (Drizzle)    │                           │   (Ecto)       │
│                │                           │                │
│  LECTURA:      │                           │  LECTURA:      │
│  - UI queries  │                           │  - Pipeline    │
│  - Chat list   │    ┌───────────────┐      │  - Webhook     │
│  - Messages    │    │               │      │    lookup      │
│  - Contacts    │───►│  PostgreSQL   │◄─────│  - Session     │
│                │    │               │      │    state       │
│  ESCRITURA:    │    │  ┌─────────┐  │      │                │
│  - Auth        │    │  │whatsapp │  │      │  ESCRITURA:    │
│  - User config │    │  │message  │  │      │  - Messages    │
│  - Chat config │    │  │contact  │  │      │  - Contacts    │
│  - Notes       │    │  │group    │  │      │  - Groups      │
│                │    │  │react.   │  │      │  - Reactions   │
│                │    │  │poll     │  │      │  - Status      │
│                │    │  │connect. │  │      │  - Oban jobs   │
│                │    │  │oban_jobs│  │      │  - Cleanup     │
│                │    │  └─────────┘  │      │                │
│                │    │               │      │                │
│  Pool A (pg)   │    │               │      │  Pool B        │
│  ~10 conns     │    │               │      │  (Postgrex)    │
│                │    └───────────────┘      │  ~20 conns     │
└───────────────┘                           └───────────────┘

REGLAS DE COEXISTENCIA:
- Next.js es PROPIETARIO de: user, session, account, verification, platform_config
- Elixir es PROPIETARIO de: message, contact, group, reaction, poll, oban_jobs
- COMPARTIDOS (ambos leen/escriben): whatsapp (connected field), connection
- Las migraciones se ejecutan desde UN solo sistema (preferiblemente Elixir)
```
