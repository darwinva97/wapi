# WAPI - WhatsApp API Gateway

Dashboard y API para integrar WhatsApp en tus aplicaciones. Conecta múltiples cuentas de WhatsApp, envía mensajes via API y recibe webhooks cuando llegan mensajes.

## ✨ Características

### 📱 Gestión de Cuentas WhatsApp
- Conecta múltiples cuentas de WhatsApp via QR code
- Dashboard para administrar todas tus cuentas
- Estado de conexión en tiempo real
- Almacenamiento de sesiones persistente

### 🔗 Conexiones (Integraciones)
Cada cuenta de WhatsApp puede tener múltiples "conexiones", que son integraciones bidireccionales:

#### 📤 Sender (Enviar mensajes via API)
- API REST para enviar mensajes
- Autenticación via Bearer token
- Soporte para mensajes de texto, imágenes, documentos, etc.
- Endpoint: `POST /api/{whatsapp_slug}/{connection_slug}/sender`

#### 📥 Receiver (Webhooks)
- Recibe mensajes entrantes via webhook
- Configura URLs personalizadas para cada conexión
- Headers personalizados para autenticación
- Payload completo del mensaje incluyendo metadatos

### 👥 Gestión de Contactos y Grupos
- Sincronización automática de contactos
- Gestión de grupos de WhatsApp
- Historial de mensajes por chat

### 🔐 Sistema de Usuarios
- Autenticación segura con Better Auth
- Roles de usuario (admin/user)
- Registro público deshabilitado (solo admins crean usuarios)
- API de administración para gestión de usuarios

### 💬 Chat en Tiempo Real
- Visualización de chats y mensajes
- Actualizaciones via Server-Sent Events (SSE)
- Historial de mensajes almacenado en base de datos

## 🛠️ Stack Tecnológico

- **Framework:** Next.js 16 (App Router)
- **Base de datos:** SQLite / Turso (LibSQL)
- **ORM:** Drizzle ORM
- **WhatsApp:** Baileys
- **Autenticación:** Better Auth
- **UI:** Tailwind CSS + shadcn/ui
- **Validación:** Zod

## 🚀 Instalación

### Prerrequisitos
- Node.js 20+
- pnpm

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd wapi
pnpm install
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y configura tus valores:

```bash
cp .env.example .env
```

Variables requeridas:

```env
# Base de datos (SQLite local o Turso)
DATABASE_URL=file:local.db
DATABASE_AUTH_TOKEN=

# Better Auth
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=tu-clave-secreta-minimo-32-caracteres

# Entorno
NODE_ENV=development
```

### 3. Crear tablas en la base de datos

```bash
pnpm db:push
```

### 4. Crear usuario administrador

```bash
pnpm db:seed
```

Credenciales por defecto:
- **Email:** admin@example.com
- **Password:** Admin123!

### 5. Iniciar el servidor

```bash
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000)

## 📖 Uso

### Conectar una cuenta de WhatsApp

1. Inicia sesión en el dashboard
2. Crea una nueva cuenta de WhatsApp
3. Escanea el código QR con tu teléfono
4. ¡Listo! La cuenta está conectada

### Crear una conexión (integración)

1. Ve a la cuenta de WhatsApp
2. Crea una nueva conexión
3. Configura el Sender (para enviar mensajes):
   - Habilita el sender
   - Copia el token generado
4. Configura el Receiver (para recibir mensajes):
   - Habilita el receiver
   - Ingresa la URL de tu webhook
   - Agrega headers si es necesario

### Enviar mensajes via API

```bash
curl -X POST "http://localhost:3000/api/{whatsapp_slug}/{connection_slug}/sender" \
  -H "Authorization: Bearer {tu-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "1234567890",
    "message": { "text": "Hola desde WAPI!" }
  }'
```

### Formato del webhook (mensajes entrantes)

Tu endpoint recibirá un POST con este formato:

```json
{
  "messages": [
    {
      "key": {
        "remoteJid": "1234567890@s.whatsapp.net",
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

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── [whatsapp_slug]/[connection_slug]/sender/  # API para enviar
│   │   ├── admin/users/create/                        # API admin
│   │   ├── auth/                                      # Better Auth
│   │   └── whatsapp/[id]/qr/                         # SSE para QR
│   ├── whatsapp/[slug]/                              # Dashboard WhatsApp
│   │   ├── connections/[connectionSlug]/             # Gestión conexiones
│   │   └── chats/                                    # Visualizar chats
│   └── login/                                        # Página de login
├── components/ui/                                    # Componentes shadcn
├── db/
│   ├── schema/                                       # Esquema Drizzle
│   └── seed.ts                                       # Seeder
├── lib/
│   ├── auth.ts                                       # Configuración Better Auth
│   ├── whatsapp.ts                                   # Lógica Baileys
│   └── whatsapp-utils.ts                             # Utilidades
└── config/                                           # Variables de entorno
```

## 🔧 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm dev` | Inicia el servidor de desarrollo |
| `pnpm build` | Compila para producción |
| `pnpm start` | Inicia el servidor de producción |
| `pnpm db:push` | Aplica el esquema a la base de datos |
| `pnpm db:studio` | Abre Drizzle Studio |
| `pnpm db:seed` | Crea el usuario admin |
| `pnpm lint` | Ejecuta ESLint |

## 📚 Documentación Adicional

- [API de Administración](docs/ADMIN_API.md)
- [Database Seeding](docs/SEEDING.md)

## 📝 Licencia

Privado - Todos los derechos reservados
