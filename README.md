# WAPI - WhatsApp API Gateway

WAPI es una plataforma self-hosted que te permite conectar cuentas de WhatsApp, visualizar chats en tiempo real, y exponer una API REST + Webhooks para integrar WhatsApp con cualquier sistema externo (CRMs, bots, n8n, Zapier, tu propia app, etc.).

## Para que sirve WAPI

| Caso de uso | Como lo resuelve WAPI |
|---|---|
| Enviar mensajes desde tu app | API REST con Bearer token por conexion |
| Recibir mensajes en tu backend | Webhooks configurables por conexion |
| Monitorear conversaciones | Dashboard web con chat en tiempo real |
| Gestionar multiples numeros | Multi-cuenta con selector de WhatsApp |
| Equipo de soporte | Sistema de miembros con roles (owner, manager, agent) |
| Automatizar con n8n/Zapier | Sender API + Receiver Webhooks |

## Stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **PostgreSQL** + Drizzle ORM
- **Baileys** (WhatsApp Web API)
- **Better Auth** (autenticacion)
- **Tailwind CSS 4** + shadcn/ui (Lunaris design system)
- **SSE** para actualizaciones en tiempo real

## Inicio rapido

### Prerrequisitos

- Node.js 20+
- pnpm
- PostgreSQL (local o Docker)

### 1. Clonar e instalar

```bash
git clone https://github.com/darwinva97/wapi.git
cd wapi
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp env.example .env
```

Edita `.env`:

```env
# PostgreSQL - ajusta segun tu setup
DATABASE_URL=postgresql://user:password@localhost:5432/wapi

# Better Auth - URL de tu instancia y una clave secreta de 32+ caracteres
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=tu-clave-secreta-de-al-menos-32-caracteres

# Entorno
NODE_ENV=development
```

> Si ya tienes PostgreSQL local en el puerto 5432, puedes levantar uno en Docker en otro puerto:
> ```bash
> docker run -d --name wapi-postgres -e POSTGRES_USER=wapi -e POSTGRES_PASSWORD=wapi -e POSTGRES_DB=wapi -p 5433:5432 postgres:17-alpine
> ```
> Y usar `DATABASE_URL=postgresql://wapi:wapi@localhost:5433/wapi`

### 3. Crear esquema y usuario admin

```bash
pnpm db:push       # Aplica el esquema a la base de datos
pnpm db:setup      # Crea usuario admin + configuracion inicial
```

Credenciales por defecto:
- **Email:** `admin@example.com`
- **Password:** `Admin123!`

### 4. Iniciar

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesion.

## Como funciona

### Flujo basico

```
Tu telefono                    WAPI                         Tu app/backend
     |                          |                                |
     |--- escanea QR --------->|                                |
     |    (Baileys conecta)     |                                |
     |                          |                                |
     |<-- mensajes entrantes --|-- webhook POST --------------->|
     |                          |                                |
     |                          |<-- POST /api/.../sender -------|
     |<-- mensaje enviado -----|                                |
```

1. **Conectas** tu WhatsApp escaneando un QR desde el dashboard
2. **Creas conexiones** (integraciones) para cada uso: una para tu bot, otra para tu CRM, etc.
3. Cada conexion tiene su propio **Sender** (API para enviar) y **Receiver** (webhook para recibir)
4. Los mensajes fluyen bidireccionalmente entre WhatsApp y tus sistemas

### Arquitectura de conexiones

```
WhatsApp Account "Ventas" (wa-slug: ventas)
  |
  |-- Conexion "Bot de soporte" (slug: bot-soporte)
  |     Sender: POST /api/ventas/bot-soporte/sender
  |     Receiver: webhook a https://mi-bot.com/webhook
  |
  |-- Conexion "CRM" (slug: crm)
  |     Sender: POST /api/ventas/crm/sender
  |     Receiver: webhook a https://mi-crm.com/api/whatsapp
  |
  |-- Conexion "n8n" (slug: n8n)
        Sender: POST /api/ventas/n8n/sender
        Receiver: webhook a https://n8n.mi-servidor.com/webhook/wa
```

## API

### Enviar mensajes

```bash
curl -X POST "http://localhost:3000/api/{wa_slug}/{connection_slug}/sender" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5491155551234",
    "message": { "text": "Hola desde WAPI!" }
  }'
```

El campo `message` acepta cualquier formato de mensaje de Baileys:

```json
// Texto
{ "text": "Hola!" }

// Imagen
{ "image": { "url": "https://..." }, "caption": "Mira esto" }

// Documento
{ "document": { "url": "https://..." }, "fileName": "factura.pdf", "mimetype": "application/pdf" }

// Ubicacion
{ "location": { "degreesLatitude": 24.121, "degreesLongitude": 55.1121 } }
```

### Recibir mensajes (Webhook)

Configura una URL de webhook en tu conexion. WAPI hara un POST a esa URL cuando llegue un mensaje:

```json
{
  "messages": [
    {
      "key": {
        "remoteJid": "5491155551234@s.whatsapp.net",
        "fromMe": false,
        "id": "ABC123"
      },
      "message": {
        "conversation": "Hola, quiero informacion"
      },
      "messageTimestamp": 1704470400,
      "pushName": "Juan Perez"
    }
  ],
  "type": "notify"
}
```

Puedes configurar headers personalizados (API keys, tokens) en la configuracion del receiver.

## Funcionalidades del Dashboard

### Chat en tiempo real
- Visualiza todas las conversaciones (personales y grupos)
- Envia mensajes de texto y archivos multimedia
- Reproductor de audio/video integrado
- Reacciones a mensajes
- Fotos de perfil de contactos (carga lazy)
- Infinite scroll en la lista de chats
- Estados de entrega: pendiente, enviado, entregado, leido
- Actualizaciones en tiempo real via SSE

### Multimedia soportado
| Tipo | Formatos | En el chat |
|---|---|---|
| Imagenes | JPG, PNG, WebP | Vista previa + click para ampliar |
| Videos | MP4, MKV, etc. | Reproductor integrado |
| Audio | OGG, MP3, etc. | Reproductor con waveform |
| Stickers | WebP animado | Render directo |
| Documentos | PDF, DOCX, etc. | Enlace de descarga |
| Ubicaciones | Lat/Lng | Link a Google Maps |

### Gestion de equipo
- **Owner**: Control total, puede eliminar la instancia
- **Manager**: Gestiona conexiones y miembros
- **Agent**: Puede ver chats y enviar mensajes

### Panel de administracion
- Configuracion de plataforma (registro, limites)
- Gestion de usuarios
- Storage: local o S3-compatible (AWS S3, MinIO, Cloudflare R2, etc.)
- Limpieza automatica de archivos multimedia

## Almacenamiento de media

Los archivos multimedia se guardan en `public/media/{whatsapp_id}/{fecha}/{mensaje_id}_{archivo}`.

Para produccion, configura S3-compatible en **Admin > Almacenamiento**:
- AWS S3
- MinIO (self-hosted)
- Cloudflare R2
- DigitalOcean Spaces
- Cualquier servicio compatible con la API de S3

## Scripts disponibles

| Comando | Que hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Compilar para produccion |
| `pnpm start` | Servidor de produccion |
| `pnpm db:push` | Aplicar esquema a la base de datos |
| `pnpm db:studio` | Abrir Drizzle Studio (explorar DB) |
| `pnpm db:setup` | Crear admin + configuracion inicial |
| `pnpm db:seed` | Solo crear usuario admin |
| `pnpm lint` | Ejecutar ESLint |

## Despliegue

### Docker

```bash
# Desarrollo con hot reload
docker-compose --profile dev up wapi-dev

# Produccion
docker-compose up
```

### Kubernetes

```bash
# Despliegue completo
IMAGE_NAME=your-registry/wapi IMAGE_TAG=v1.0.0 ./deploy.sh full

# Ver estado
./deploy.sh status
```

Caracteristicas del despliegue:
- Multi-stage Dockerfile optimizado
- Volumenes persistentes para sesiones y media
- ConfigMaps y Secrets
- Health checks y resource limits
- Soporte para Kustomize

Documentacion detallada:
- [Guia Rapida de Kubernetes](docs/KUBERNETES_QUICKSTART.md)
- [Documentacion Completa](docs/KUBERNETES.md)
- [Guia para k3s](docs/K3S.md)

## Estructura del proyecto

```
src/
  app/
    api/
      [wa_slug]/[conn_slug]/sender/  # API para enviar mensajes
      admin/                          # APIs de administracion
      auth/                           # Better Auth endpoints
      sse/chat/[chatId]/              # Server-Sent Events
      whatsapp/[id]/qr/              # QR code via SSE
      whatsapp/[id]/profile-picture/  # Fotos de perfil
    admin/                            # Panel de administracion
    whatsapp/
      create/                         # Crear cuenta WhatsApp
      [slug]/                         # Dashboard por cuenta
        chats/                        # Vista de chats
        contacts/                     # Lista de contactos
        groups/                       # Lista de grupos
        members/                      # Gestion de miembros
        connections/                  # Integraciones
        settings/                     # Configuracion
    login/ signup/                    # Autenticacion
  components/
    ui/                               # shadcn/ui (Lunaris)
    logout-button.tsx                 # Componente de logout
  db/
    schema/                           # Esquema Drizzle (PostgreSQL)
    setup.ts                          # Setup inicial
  lib/
    auth.ts                           # Better Auth config
    whatsapp.ts                       # Logica Baileys
    storage.ts                        # Storage local/S3
```

## Licencia

Privado - Todos los derechos reservados
