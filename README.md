# WAPI - WhatsApp Integration Platform

Plataforma multi-tenant para integrar WhatsApp en tus aplicaciones. Conecta multiples cuentas de WhatsApp simultaneamente, envia mensajes via API REST, recibe webhooks, y visualiza chats en tiempo real.

**Frontend** en Next.js 16 + **Backend** en Elixir/OTP, compartiendo la misma base de datos PostgreSQL.

```
wapi/
├── src/                    # Next.js frontend (React 19, TypeScript)
├── wapi_elixir/            # Elixir/OTP backend (Phoenix 1.7, Broadway, Oban)
├── docs/                   # Documentacion de arquitectura y migracion
└── drizzle/                # Migraciones Drizzle ORM
```

---

## Arquitectura

```
┌──────────────────────┐     ┌───────────────────────────────────────────┐
│   Next.js Frontend   │     │          Elixir/OTP Backend               │
│   (port 3000)        │     │          (port 4000)                      │
│                      │     │                                           │
│  - React 19 UI       │◄───►│  Phoenix Channels (WebSocket)             │
│  - Chat interface    │ ws  │    ├─ chat:*    (mensajes, typing)        │
│  - Admin panel       │     │    ├─ qr:*      (QR code streaming)      │
│  - Auth (better-auth)│     │    └─ session:* (estado de conexion)      │
│                      │     │                                           │
│  - SSR / API routes  │     │  REST API                                 │
│                      │     │    ├─ POST /api/v1/:wa/:conn/sender       │
│                      │     │    ├─ GET  /health                        │
│                      │     │    └─ /api/v1/sessions/* (CRUD)           │
└──────────┬───────────┘     │                                           │
           │                 │  WhatsApp Session Management               │
           │                 │    ├─ GenServer por sesion (OTP)           │
           │                 │    ├─ DynamicSupervisor (fault-tolerant)   │
           │                 │    └─ Node.js sidecar (Baileys 7.0)       │
           │                 │                                           │
           │  shared DB      │  Broadway Pipeline                        │
           ▼                 │    └─ 10 processors → DB batch insert     │
    ┌─────────────┐         │                                           │
    │ PostgreSQL   │◄────────│  Oban Workers                             │
    │ (Neon/local) │         │    ├─ WebhookWorker (entrega + reintentos)│
    └─────────────┘         │    ├─ CleanupWorker  (retencion de media) │
                             │    └─ SyncWorker     (reconciliacion)     │
                             └───────────────────────────────────────────┘
```

Ambos servicios comparten la **misma base de datos PostgreSQL**. El frontend maneja autenticacion y UI. El backend maneja toda la comunicacion WhatsApp, procesamiento de mensajes, y entrega en tiempo real.

---

## Stack Tecnologico

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI, shadcn/ui |
| Backend | Elixir 1.17+, Phoenix 1.7, Broadway, Oban, GenStage |
| WhatsApp | Baileys 7.0-rc.9 (sidecar Node.js via Erlang Port) |
| Base de datos | PostgreSQL 16+ (compatible con Neon), Ecto / Drizzle ORM |
| Autenticacion | better-auth (sesiones compartidas en DB) |
| Tiempo real | Phoenix Channels (WebSocket) + PubSub |
| Jobs | Oban (colas respaldadas por PostgreSQL, cron) |
| Rate Limiting | PlugAttack (60 req/min por token, 120 req/min por IP) |
| Validacion | Zod (frontend), Ecto Changesets (backend) |

---

## Prerequisitos

- **Node.js** >= 20
- **Elixir** >= 1.17 con Erlang/OTP >= 27
- **PostgreSQL** 16+ (o Neon serverless)
- **pnpm** (para el frontend)

---

## Inicio Rapido

### 1. Clonar y configurar

```bash
git clone <repo-url> wapi
cd wapi
cp .env.example .env
# Edita .env con tu DATABASE_URL y secrets
```

### 2. Frontend (Next.js)

```bash
pnpm install
pnpm db:push          # Push del schema Drizzle a la DB
pnpm db:seed          # Crear usuario admin
pnpm dev              # http://localhost:3000
```

Credenciales por defecto del seed:
- **Email:** admin@example.com
- **Password:** Admin123!

### 3. Backend (Elixir/OTP)

```bash
cd wapi_elixir

# Instalar dependencias
mix deps.get
cd priv/baileys-bridge && npm install && cd ../..

# Configurar base de datos (Neon requiere SSL)
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Correr migraciones e iniciar
mix ecto.migrate
mix phx.server        # http://localhost:4000
```

### 4. Verificar

```bash
# Health check del backend
curl http://localhost:4000/health
# => {"status":"ok","timestamp":"...","active_sessions":0}
```

---

## Variables de Entorno

### Raiz (.env) - Frontend Next.js

| Variable | Requerida | Descripcion |
|----------|-----------|-------------|
| `DATABASE_URL` | Si | Connection string de PostgreSQL |
| `BETTER_AUTH_SECRET` | Si | Secret para firmar sesiones (32+ chars) |
| `BETTER_AUTH_URL` | Si | URL base de auth (ej. `http://localhost:3000`) |

### wapi_elixir - Backend Elixir

| Variable | Requerida | Default | Descripcion |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | Si | - | URL de PostgreSQL (ecto:// o postgresql://) |
| `SECRET_KEY_BASE` | Prod | dev default | Clave de firma Phoenix (64+ chars) |
| `PORT` | No | `4000` | Puerto HTTP |
| `PHX_HOST` | No | `localhost` | Hostname para generacion de URLs |
| `POOL_SIZE` | No | `10` | Tamano del pool de conexiones DB |
| `NODE_PATH` | No | `node` | Ruta al binario de Node.js |
| `BRIDGE_SCRIPT` | No | `priv/baileys-bridge/index.js` | Ruta al bridge Baileys |
| `SESSIONS_DIR` | No | `whatsapp_sessions` | Directorio de sesiones WhatsApp |

---

## Caracteristicas

### Gestion de Cuentas WhatsApp
- Conecta multiples cuentas de WhatsApp via QR code
- Dashboard para administrar todas tus cuentas
- Estado de conexion en tiempo real
- Almacenamiento de sesiones persistente
- Reconexion automatica con backoff exponencial (1s a 60s)

### Conexiones (Integraciones)
Cada cuenta de WhatsApp puede tener multiples "conexiones" bidireccionales:

**Sender (Enviar mensajes via API)**
- API REST con autenticacion Bearer token
- Soporte para texto, imagenes, video, audio, documentos, stickers, ubicacion
- Tracking de mensajes enviados con connection_id

**Receiver (Webhooks)**
- Recibe mensajes entrantes via webhook HTTP
- URLs personalizadas por conexion
- Headers de autenticacion configurables
- Reintentos automaticos con backoff exponencial (max 5 intentos)

### Mensajes Multimedia
| Tipo | Formato | Descripcion |
|------|---------|-------------|
| Texto | Texto plano | Mensajes estandar |
| Imagenes | JPG, PNG, WebP | Se muestran inline en el chat |
| Videos | MP4, MKV, etc. | Reproductor integrado |
| Audio | OGG, MP3, etc. | Reproductor de audio |
| Stickers | WebP | Stickers de WhatsApp |
| Documentos | PDF, DOCX, etc. | Enlace de descarga |
| Ubicacion | Lat/Lng | Mapa embebido |

### Estados de Entrega (ackStatus)
Cada mensaje tiene un estado que se actualiza en tiempo real:
- **0**: Pendiente - El mensaje esta en cola
- **1**: Enviado - Entregado al servidor de WhatsApp
- **2**: Entregado - Recibido por el destinatario
- **3**: Leido - El destinatario leyo el mensaje

### Multi-Tenancy
- Cada instancia WhatsApp pertenece a un **usuario** (owner)
- **Miembros** con roles: `owner`, `manager`, `agent`
- Rate limiting por token y por IP
- Aislamiento de sesiones via procesos OTP independientes

---

## Estructura del Proyecto

### Frontend (`src/`)

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Paginas de auth (login, signup)
│   ├── admin/                    # Panel de administracion
│   ├── whatsapp/[slug]/          # Dashboard por cuenta WhatsApp
│   │   ├── connections/          # Gestion de conexiones
│   │   └── chats/                # Visualizacion de chats
│   └── api/                      # API routes
│       ├── [wa_slug]/[conn_slug]/sender/  # Sender API
│       ├── admin/                # Admin endpoints
│       ├── auth/                 # Better Auth
│       ├── sse/chat/             # SSE para chat (legacy)
│       └── whatsapp/[id]/qr/    # SSE para QR (legacy)
├── components/ui/                # Componentes shadcn/Radix
├── db/
│   └── schema/                   # Schema Drizzle ORM
│       ├── user.ts               # user, session, account, verification
│       ├── whatsapp.ts           # whatsapp, contact, group, message, reaction, poll
│       └── config.ts             # platform_config, user_config, cleanup_config, etc.
├── lib/
│   ├── whatsapp.ts               # Gestion de sesiones Baileys (legacy)
│   ├── storage.ts                # Almacenamiento (local + S3)
│   └── cleanup-job.ts            # Limpieza de media
└── hooks/                        # React hooks
```

### Backend (`wapi_elixir/`)

```
wapi_elixir/
├── lib/
│   ├── wapi/
│   │   ├── schema/                   # 19 Ecto schemas (espejo de Drizzle)
│   │   ├── whatsapp/
│   │   │   ├── session_server.ex     # GenServer por sesion WhatsApp
│   │   │   ├── session_supervisor.ex # DynamicSupervisor (fault-tolerant)
│   │   │   ├── session_bootstrap.ex  # Reconectar sesiones al iniciar
│   │   │   └── node_bridge.ex        # Erlang Port ↔ Node.js Baileys
│   │   ├── pipeline/
│   │   │   ├── message_producer.ex   # GenStage producer (buffer de eventos)
│   │   │   ├── message_parser.ex     # Deteccion de tipo de mensaje
│   │   │   └── message_pipeline.ex   # Broadway (10 processors, batch DB)
│   │   ├── workers/
│   │   │   ├── webhook_worker.ex     # Entrega HTTP con backoff exponencial
│   │   │   ├── cleanup_worker.ex     # Retencion de media (cron 3am)
│   │   │   ├── sync_worker.ex        # Reconciliacion DB ↔ proceso
│   │   │   └── orphan_session_worker.ex  # Limpieza de sesiones huerfanas
│   │   ├── sender/sender.ex         # Enviar mensajes via Baileys
│   │   ├── storage/storage.ex        # Almacenamiento local + S3
│   │   └── authorization.ex          # Control de acceso owner/member
│   └── wapi_web/
│       ├── channels/
│       │   ├── chat_channel.ex       # Mensajes de chat en tiempo real
│       │   ├── qr_channel.ex         # Streaming de codigo QR
│       │   └── session_channel.ex    # Actualizaciones de estado
│       ├── controllers/
│       │   ├── sender_controller.ex  # POST /api/v1/:wa/:conn/sender
│       │   ├── session_controller.ex # CRUD de sesiones
│       │   └── health_controller.ex  # GET /health
│       ├── plugs/
│       │   ├── auth.ex               # Autenticacion Bearer token
│       │   └── rate_limiter.ex       # PlugAttack rate limiting
│       └── router.ex
├── priv/
│   ├── baileys-bridge/               # Sidecar Node.js
│   │   ├── index.js                  # Protocolo JSON stdin/stdout
│   │   ├── session-manager.js        # Ciclo de vida de sesiones Baileys
│   │   └── event-mapper.js           # Serializacion de eventos
│   └── repo/migrations/              # Migraciones Ecto (5 archivos)
├── config/                           # Configuracion compile-time + runtime
├── Dockerfile                        # Multi-stage (Elixir + Node.js)
└── docker-compose.yml                # Stack completo
```

---

## Conceptos Clave

### Gestion de Sesiones WhatsApp

Cada cuenta de WhatsApp corre como un **GenServer** aislado, supervisado por un `DynamicSupervisor`. Las sesiones sobreviven crashes con reconexion automatica usando backoff exponencial.

El protocolo WhatsApp corre en un **sidecar Node.js** (libreria Baileys) que se comunica con Elixir via un Erlang Port usando JSON delimitado por newlines en stdin/stdout.

```
Elixir (NodeBridge GenServer)
    │
    ├── stdin: {"action":"connect","whatsapp_id":"abc123"}
    │
    └── stdout: {"event":"messages.upsert","whatsapp_id":"abc123","data":{...}}
    │
Node.js (Baileys Bridge)
    └── WhatsApp WebSocket connection
```

### Pipeline de Mensajes

Los eventos entrantes de WhatsApp fluyen a traves de un **Broadway pipeline**:

1. **NodeBridge** recibe eventos del sidecar JS
2. **MessageProducer** bufferea eventos con control de flujo por demanda
3. **10 procesadores** concurrentes parsean y validan mensajes
4. **Batch inserter** escribe a PostgreSQL en lotes de 50
5. **PubSub** broadcastea a clientes WebSocket conectados
6. **Oban** agenda jobs de entrega de webhooks

### Base de Datos

19 tablas compartidas entre frontend y backend:

| Grupo | Tablas |
|-------|--------|
| Auth | `user`, `session`, `account`, `verification` |
| WhatsApp | `whatsapp`, `contact`, `group`, `connection` |
| Mensajes | `message`, `reaction`, `poll`, `poll_vote` |
| Config | `platform_config`, `user_config`, `whatsapp_member`, `whatsapp_cleanup_config`, `chat_config`, `chat_note`, `storage_config` |
| Jobs | `oban_jobs`, `oban_peers` (interno de Oban) |

Las migraciones se manejan con **Drizzle** (frontend) y **Ecto** (backend). Ambos usan `create_if_not_exists` para coexistir.

---

## API Reference

### REST Endpoints

| Metodo | Ruta | Auth | Descripcion |
|--------|------|------|-------------|
| `GET` | `/health` | Ninguna | Health check con conteo de sesiones activas |
| `POST` | `/api/v1/:wa/:conn/sender` | Bearer (token de conexion) | Enviar mensaje WhatsApp |
| `GET` | `/api/v1/sessions` | Bearer (sesion de usuario) | Listar sesiones activas |
| `POST` | `/api/v1/sessions/:id/connect` | Bearer (sesion de usuario) | Conectar sesion WhatsApp |
| `POST` | `/api/v1/sessions/:id/disconnect` | Bearer (sesion de usuario) | Desconectar sesion |
| `DELETE` | `/api/v1/sessions/:id/reset` | Bearer (sesion de usuario) | Resetear sesion (borrar auth) |

### Enviar mensajes via API

```bash
curl -X POST "http://localhost:4000/api/v1/{whatsapp_slug}/{connection_slug}/sender" \
  -H "Authorization: Bearer {connection_sender_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5491112345678@s.whatsapp.net",
    "message": { "text": "Hola desde WAPI!" }
  }'
```

### Formato del Webhook (mensajes entrantes)

Tu endpoint recibira un POST con este formato:

```json
{
  "messages": [
    {
      "key": {
        "remoteJid": "5491112345678@s.whatsapp.net",
        "fromMe": false,
        "id": "MESSAGE_ID"
      },
      "message": {
        "conversation": "Hola!"
      },
      "messageTimestamp": 1704470400,
      "pushName": "Nombre del contacto"
    }
  ],
  "type": "notify"
}
```

### WebSocket Channels

Conectar a `ws://localhost:4000/socket` con parametro `token` (token de sesion better-auth).

| Channel | Eventos | Descripcion |
|---------|---------|-------------|
| `chat:{chat_id}` | `new_message`, `message_ack`, `typing` | Chat en tiempo real |
| `qr:{whatsapp_id}` | `qr_code`, `status_change` | Flujo de emparejamiento QR |
| `session:{whatsapp_id}` | `status_change` | Estado de conexion |

### LiveDashboard (solo dev)

Visita `http://localhost:4000/dev/dashboard` para monitorear procesos, tablas ETS, y metricas.

---

## Docker

### Desarrollo (stack completo)

```bash
cd wapi_elixir
docker compose up
# PostgreSQL (5432) + Elixir backend (4000) + Next.js frontend (3000)
```

### Produccion (solo Elixir)

```bash
cd wapi_elixir
docker build -t wapi-elixir .
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e SECRET_KEY_BASE="$(mix phx.gen.secret)" \
  -e PHX_HOST="tudominio.com" \
  -p 4000:4000 \
  wapi-elixir
```

El Dockerfile usa un build multi-stage: release de Elixir + bridge Node.js + runtime Debian slim.

### Kubernetes

```bash
IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh full
```

Documentacion completa en:
- [Guia Rapida de Kubernetes](docs/KUBERNETES_QUICKSTART.md)
- [Documentacion Completa](docs/KUBERNETES.md)
- [Guia para k3s](docs/K3S.md)

---

## Scripts

### Frontend (Next.js)

| Comando | Descripcion |
|---------|-------------|
| `pnpm dev` | Servidor de desarrollo (port 3000) |
| `pnpm build` | Compilar para produccion |
| `pnpm start` | Servidor de produccion |
| `pnpm db:push` | Aplicar schema Drizzle a la DB |
| `pnpm db:studio` | Abrir Drizzle Studio |
| `pnpm db:seed` | Crear usuario admin |
| `pnpm db:migrate` | Correr migraciones Drizzle |
| `pnpm cleanup` | Ejecutar limpieza de media |
| `pnpm lint` | Ejecutar ESLint |

### Backend (Elixir)

| Comando | Descripcion |
|---------|-------------|
| `mix phx.server` | Iniciar servidor Phoenix (port 4000) |
| `iex -S mix phx.server` | Servidor con shell interactivo |
| `mix ecto.migrate` | Correr migraciones Ecto |
| `mix ecto.rollback` | Revertir ultima migracion |
| `mix test` | Correr tests |
| `mix credo` | Analisis estatico de codigo |
| `mix dialyzer` | Analisis de tipos |

---

## Documentacion

### Arquitectura y Migracion

| Documento | Descripcion |
|-----------|-------------|
| [Migration Overview](docs/ELIXIR_MIGRATION_OVERVIEW.md) | Comparacion de arquitectura, estrategia de migracion |
| [Phase 1 - Sessions](docs/ELIXIR_PHASE1_SESSIONS.md) | Diseno GenServer + DynamicSupervisor |
| [Phase 2 - Realtime](docs/ELIXIR_PHASE2_REALTIME.md) | Phoenix Channels reemplazando SSE |
| [Phase 3 - Pipeline](docs/ELIXIR_PHASE3_PIPELINE.md) | Broadway message processing pipeline |
| [Phase 4 - API & Jobs](docs/ELIXIR_PHASE4_API_JOBS.md) | Sender API + Oban background jobs |
| [Phase 5 - Database](docs/ELIXIR_PHASE5_DATABASE.md) | Migracion Drizzle a Ecto |
| [Project Structure](docs/ELIXIR_PROJECT_STRUCTURE.md) | Estructura completa y Docker |
| [Architecture Diagrams](docs/ELIXIR_ARCHITECTURE_DIAGRAMS.md) | Diagramas ASCII de arquitectura |

### Operaciones

| Documento | Descripcion |
|-----------|-------------|
| [Admin API](docs/ADMIN_API.md) | API de administracion |
| [Feature Requirements](docs/FEATURE_REQUIREMENTS.md) | Requerimientos de features |
| [Kubernetes Quickstart](docs/KUBERNETES_QUICKSTART.md) | Despliegue rapido en K8s |
| [Kubernetes Guide](docs/KUBERNETES.md) | Guia completa de Kubernetes |
| [k3s Guide](docs/K3S.md) | Despliegue en k3s |
| [Seeding](docs/SEEDING.md) | Guia de seeding de datos |

---

## Licencia

Privado - Todos los derechos reservados.
