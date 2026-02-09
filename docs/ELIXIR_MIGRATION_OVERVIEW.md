# Migracion a Elixir/OTP - Vision General

## Resumen Ejecutivo

WAPI es una plataforma multi-tenant de gestion de WhatsApp construida con Next.js 16, Baileys 7, y PostgreSQL (Drizzle ORM). Aunque funcional, la arquitectura actual presenta limitaciones inherentes al modelo single-process de Node.js que afectan concurrencia, supervision de sesiones, y escalabilidad horizontal.

Este documento describe la estrategia de migracion gradual del backend a Elixir/OTP, manteniendo el frontend en Next.js/React.

---

## Arquitectura Actual

```
┌──────────────────────────────────────────────────────────────┐
│                     NEXT.JS 16 (Monolito)                    │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   Frontend   │  │  API Routes  │  │   SSE Endpoints     │ │
│  │   React 19   │  │  (REST)      │  │   (EventEmitter)    │ │
│  └─────────────┘  └──────┬───────┘  └─────────┬───────────┘ │
│                          │                     │             │
│  ┌───────────────────────┴─────────────────────┴───────────┐ │
│  │              whatsapp.ts (Core)                          │ │
│  │  - Map<string, WASocket> global                         │ │
│  │  - Set<string> connectingLocks                          │ │
│  │  - EventEmitter (max 100 listeners)                     │ │
│  │  - setTimeout para reconexion                           │ │
│  │  - Handler monolitico messages.upsert (~480 lineas)     │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                   │
│  ┌───────────────────────┴─────────────────────────────────┐ │
│  │              Baileys 7.0.0-rc.9                         │ │
│  │  - WebSocket a servidores WhatsApp                      │ │
│  │  - Auth state en filesystem (whatsapp_sessions/)        │ │
│  │  - Signal Protocol encryption                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │   Drizzle    │  │   Storage    │  │   Cleanup Job     │  │
│  │   ORM        │  │   (Local/S3) │  │   (Manual/Cron)   │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────┘  │
└─────────┼────────────────────────────────────────────────────┘
          │
    ┌─────┴─────┐
    │ PostgreSQL │
    └───────────┘
```

### Problemas Identificados

| Problema | Archivo | Impacto |
|----------|---------|---------|
| Map global para sesiones | `src/lib/whatsapp.ts:70-95` | Sin persistencia entre reinicios, no escala horizontalmente |
| Locks manuales con Set | `src/lib/whatsapp.ts:39` | Race conditions posibles, no distribuido |
| EventEmitter con limite 100 | `src/lib/whatsapp.ts:81` | Limite de clientes SSE concurrentes |
| setTimeout para reconexion | `src/lib/whatsapp.ts:1247,1258` | Sin backoff exponencial real, sin supervision |
| Handler monolitico | `src/lib/whatsapp.ts:646-1125` | ~480 lineas en un solo handler, dificil de mantener/testear |
| Webhooks sin retry | `src/lib/whatsapp.ts:1106-1114` | fetch sin timeout, sin retry, sin dead letter queue |
| Cleanup job manual | `src/lib/cleanup-job.ts` | Sin scheduling automatico, procesamiento secuencial |
| SSE single-process | `src/app/api/sse/chat/[chatId]/route.ts` | No funciona con multiples instancias del servidor |
| Sender sin rate-limiting | `src/app/api/[...]/sender/route.ts` | Sin proteccion contra abuso de API |

---

## Arquitectura Propuesta (Hibrida)

```
┌─────────────────────┐         ┌──────────────────────────────────┐
│    NEXT.JS 16        │         │         ELIXIR/OTP               │
│    (Frontend +       │  HTTP   │         (Backend Core)           │
│     Auth API)        │◄───────►│                                  │
│                      │         │  ┌────────────────────────────┐  │
│  - React 19 UI       │  WS     │  │   Phoenix 1.7              │  │
│  - better-auth       │◄───────►│  │   - Channels (realtime)    │  │
│  - Paginas/Layouts   │         │  │   - REST API (sender)      │  │
│  - Assets estaticos  │         │  │   - PubSub distribuido     │  │
└─────────────────────┘         │  └────────────────────────────┘  │
                                │                                  │
                                │  ┌────────────────────────────┐  │
                                │  │   Supervision Tree          │  │
                                │  │   - DynamicSupervisor       │  │
                                │  │   - GenServer por sesion    │  │
                                │  │   - Registry para lookup    │  │
                                │  └────────────────────────────┘  │
                                │                                  │
                                │  ┌────────────────────────────┐  │
                                │  │   Broadway Pipeline         │  │
                                │  │   - Message processing      │  │
                                │  │   - Media download workers  │  │
                                │  │   - Webhook dispatch        │  │
                                │  └────────────────────────────┘  │
                                │                                  │
                                │  ┌────────────────────────────┐  │
                                │  │   Oban (Job Processing)     │  │
                                │  │   - Cleanup jobs            │  │
                                │  │   - Sync periodico          │  │
                                │  │   - Dead letter queue       │  │
                                │  └────────────────────────────┘  │
                                │                                  │
                                │  ┌────────────────────────────┐  │
                                │  │   Node.js Sidecar           │  │
                                │  │   - Baileys (WhatsApp WS)   │  │
                                │  │   - Comunicacion via Port   │  │
                                │  └────────────────────────────┘  │
                                │                                  │
                                │  ┌────────────────────────────┐  │
                                │  │   Ecto + PostgreSQL         │  │
                                │  │   - Schemas tipados         │  │
                                │  │   - Changesets              │  │
                                │  │   - Migraciones con rollback│  │
                                │  └────────────────────────────┘  │
                                └──────────────────────────────────┘
```

---

## Componentes: Migrar vs. Mantener

### Se migra a Elixir

| Componente | Archivo Actual | Modulo Elixir | Fase |
|------------|---------------|---------------|------|
| Gestion de sesiones WA | `src/lib/whatsapp.ts` (conectar, desconectar, reconectar) | `Wapi.WhatsApp.SessionServer` (GenServer) | 1 |
| Supervision de sesiones | `src/lib/whatsapp.ts` (connectingLocks, Map global) | `Wapi.WhatsApp.SessionSupervisor` (DynamicSupervisor) | 1 |
| SSE realtime | `src/app/api/sse/chat/[chatId]/route.ts` | `WapiWeb.ChatChannel` (Phoenix Channel) | 2 |
| QR streaming | `src/app/api/whatsapp/[id]/qr/route.ts` | `WapiWeb.QrChannel` (Phoenix Channel) | 2 |
| EventEmitter global | `src/lib/whatsapp.ts:79-84` | `Phoenix.PubSub` | 2 |
| Procesamiento mensajes | `src/lib/whatsapp.ts:646-1125` (messages.upsert handler) | `Wapi.Pipeline.MessageProducer` (Broadway) | 3 |
| Descarga de media | `src/lib/media.ts` | `Wapi.Pipeline.MediaWorker` (Broadway batcher) | 3 |
| Webhooks | `src/lib/whatsapp.ts:1088-1124` | `Wapi.Pipeline.WebhookDispatcher` (Oban worker) | 3 |
| Sender API | `src/app/api/[...]/sender/route.ts` | `WapiWeb.SenderController` + rate-limit | 4 |
| Cleanup job | `src/lib/cleanup-job.ts` | `Wapi.Workers.CleanupWorker` (Oban cron) | 4 |
| Sync periodico | `src/lib/whatsapp.ts:1488-1509` | `Wapi.Workers.SyncWorker` (Oban cron) | 4 |
| Esquema DB (opcional) | `src/db/schema/*.ts` | `Wapi.Schema.*` (Ecto) | 5 |

### Se mantiene en Next.js

| Componente | Razon |
|------------|-------|
| Frontend React (UI completa) | React 19, Radix UI, Tailwind - ecosistema maduro |
| Autenticacion (better-auth) | Ya configurado con sessions, accounts, verification |
| Paginas y layouts | Next.js App Router, SSR/RSC |
| Assets estaticos | Next.js Image optimization, public/ serving |

---

## Tabla de Prioridades

| Fase | Nombre | Prioridad | Complejidad | Impacto | Documento |
|------|--------|-----------|-------------|---------|-----------|
| 1 | Gestion de Sesiones | **CRITICA** | Alta | Elimina crashes por sesiones, supervision automatica | [ELIXIR_PHASE1_SESSIONS.md](./ELIXIR_PHASE1_SESSIONS.md) |
| 2 | Realtime (Channels) | **ALTA** | Media | SSE escalable, presencia de agentes, multi-nodo | [ELIXIR_PHASE2_REALTIME.md](./ELIXIR_PHASE2_REALTIME.md) |
| 3 | Pipeline Mensajes | **ALTA** | Alta | Procesamiento paralelo, backpressure, retry | [ELIXIR_PHASE3_PIPELINE.md](./ELIXIR_PHASE3_PIPELINE.md) |
| 4 | API + Jobs | **MEDIA** | Media | Rate-limiting, jobs confiables, cron | [ELIXIR_PHASE4_API_JOBS.md](./ELIXIR_PHASE4_API_JOBS.md) |
| 5 | Database (Ecto) | **BAJA** | Media | Mejor validacion, transacciones atomicas | [ELIXIR_PHASE5_DATABASE.md](./ELIXIR_PHASE5_DATABASE.md) |

---

## Stack Tecnologico Elixir Propuesto

| Tecnologia | Version | Proposito |
|-----------|---------|-----------|
| **Elixir** | ~> 1.17 | Lenguaje |
| **OTP** | ~> 27 | Plataforma runtime (BEAM VM) |
| **Phoenix** | ~> 1.7 | Framework web (HTTP + WebSocket) |
| **Phoenix LiveView** | ~> 1.0 | (Opcional) Dashboard admin |
| **Ecto** | ~> 3.12 | ORM y migraciones |
| **Postgrex** | ~> 0.19 | Driver PostgreSQL |
| **Broadway** | ~> 1.1 | Pipeline de procesamiento de datos |
| **Oban** | ~> 2.18 | Job processing con PostgreSQL |
| **Jason** | ~> 1.4 | Codificacion/decodificacion JSON |
| **PlugAttack** | ~> 0.4 | Rate limiting por IP/token |
| **Telemetry** | ~> 1.3 | Metricas y observabilidad |
| **ExUnit** | (built-in) | Testing |
| **Credo** | ~> 1.7 | Analisis estatico de codigo |
| **Dialyxir** | ~> 1.4 | Typespecs y analisis de tipos |

### Herramientas de Desarrollo

| Herramienta | Proposito |
|------------|-----------|
| **mix** | Build tool y package manager |
| **iex** | REPL interactivo con hot-reload |
| **observer** | GUI para inspeccionar procesos BEAM en vivo |
| **:recon** | Debugging de produccion |
| **Docker** | Containerizacion y deployment |

---

## Estrategia de Migracion

### Principios

1. **Migracion incremental**: Cada fase es independiente y desplegable por separado
2. **Coexistencia**: Next.js y Elixir corren simultaneamente durante la transicion
3. **Base de datos compartida**: Ambos sistemas leen/escriben la misma PostgreSQL
4. **Zero downtime**: Cada fase se puede activar con feature flags
5. **Rollback seguro**: Cada fase puede revertirse al comportamiento Node.js

### Orden de Ejecucion

```
Fase 1 (Sesiones)     ████████████████░░░░░░░░░░░░░░░░░░░░░░░░
Fase 2 (Realtime)     ░░░░░░░░████████████████░░░░░░░░░░░░░░░░
Fase 3 (Pipeline)     ░░░░░░░░░░░░░░░░████████████████░░░░░░░░
Fase 4 (API/Jobs)     ░░░░░░░░░░░░░░░░░░░░░░░░████████████████
Fase 5 (Database)     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████
                      Semana 1-4     5-8      9-12    13-16  17+
```

---

## Documentos Relacionados

- [Fase 1: Gestion de Sesiones](./ELIXIR_PHASE1_SESSIONS.md)
- [Fase 2: Realtime con Phoenix Channels](./ELIXIR_PHASE2_REALTIME.md)
- [Fase 3: Pipeline con Broadway](./ELIXIR_PHASE3_PIPELINE.md)
- [Fase 4: API Sender + Jobs con Oban](./ELIXIR_PHASE4_API_JOBS.md)
- [Fase 5: Migracion de Database a Ecto](./ELIXIR_PHASE5_DATABASE.md)
- [Estructura del Proyecto](./ELIXIR_PROJECT_STRUCTURE.md)
- [Diagramas de Arquitectura](./ELIXIR_ARCHITECTURE_DIAGRAMS.md)
