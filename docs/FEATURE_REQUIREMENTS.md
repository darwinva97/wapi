# WAPI - Requisitos de Nuevas Funcionalidades

Este documento describe las funcionalidades planificadas para WAPI, organizadas por módulo.

---

## 1. Sistema de Roles y Permisos

### 1.1 Roles de Plataforma

| Rol | Descripción |
|-----|-------------|
| **admin** | Control total del sistema. CRUD de usuarios, configuración global de la plataforma |
| **user** | Usuario estándar. Puede crear instancias de WhatsApp según la configuración de la plataforma |

#### Permisos de Admin
- Crear, editar, eliminar y banear usuarios
- Configurar permisos globales de la plataforma
- Cambiar roles de usuarios
- Ver todas las instancias de WhatsApp (opcional, para soporte)

#### Permisos de User
- Crear instancias de WhatsApp (si está habilitado en configuración)
- Gestionar sus propias instancias
- No puede modificar otros usuarios

### 1.2 Configuración Global de Plataforma (Solo Admin)

Nueva tabla `platform_config` con configuración singleton:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `allow_registration` | boolean | ¿Permitir registro público de usuarios? |
| `allow_user_create_whatsapp` | boolean | ¿Los usuarios pueden crear instancias de WhatsApp? |
| `default_max_whatsapp_instances` | integer | Límite por defecto de instancias por usuario (0 = ilimitado) |

#### Sobrescritura por Usuario

Nueva tabla `user_config` para configuración individual:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `user_id` | FK → user | Usuario al que aplica |
| `can_create_whatsapp` | boolean \| null | Sobrescribe config global (null = usar global) |
| `max_whatsapp_instances` | integer \| null | Sobrescribe límite global (null = usar global) |

**Lógica de resolución:**
1. Si `user_config` tiene valor específico → usar ese valor
2. Si `user_config` es null → usar `platform_config`

---

### 1.3 Roles de Instancia de WhatsApp

Cada instancia de WhatsApp tiene su propio sistema de roles:

| Rol | Descripción |
|-----|-------------|
| **owner** | Control total de la instancia. Puede agregar/eliminar cualquier rol |
| **manager** | Gestión avanzada. Puede agregar managers y agents. Solo puede eliminar agents |
| **agent** | Operador de chat. Solo puede enviar/recibir mensajes y gestionar retención de assets |

#### Nueva tabla `whatsapp_member`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK |
| `whatsapp_id` | FK → whatsapp | Instancia de WhatsApp |
| `user_id` | FK → user | Usuario miembro |
| `role` | enum | 'owner' \| 'manager' \| 'agent' |
| `created_at` | timestamp | Fecha de asignación |
| `created_by` | FK → user | Quién asignó el rol |

#### Reglas de Negocio

- Al crear una instancia de WhatsApp, el creador se convierte automáticamente en **owner**
- Un **owner** puede:
  - Agregar/eliminar owners, managers y agents
  - Transferir ownership
  - Eliminar la instancia
- Un **manager** puede:
  - Agregar managers y agents
  - Eliminar solo agents
  - Gestionar conexiones y configuración
- Un **agent** puede:
  - Enviar y recibir mensajes
  - Configurar retención de assets por mensaje (dentro del límite configurado)
  - Ver chats asignados (si se implementa asignación de chats)

---

## 2. Sistema de Almacenamiento

### 2.1 Configuración de Storage

Nueva tabla `storage_config` (singleton):

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `storage_type` | enum | 'local' \| 's3' |
| `s3_endpoint` | text | URL del endpoint (Backblaze B2, MinIO, AWS S3, etc.) |
| `s3_bucket` | text | Nombre del bucket |
| `s3_region` | text | Región del bucket |
| `s3_access_key` | text | Access Key ID (encriptado) |
| `s3_secret_key` | text | Secret Access Key (encriptado) |
| `s3_public_url` | text | URL pública para servir archivos (opcional, para CDN) |

#### Comportamiento

- **Local**: Archivos en `public/media/` (comportamiento actual)
- **S3-compatible**: Archivos en bucket externo
  - Compatible con: AWS S3, Backblaze B2, MinIO, DigitalOcean Spaces, Cloudflare R2, etc.
  - URLs públicas o firmadas (configurable)

### 2.2 Política de Limpieza de Archivos

#### Configuración a Nivel de Instancia WhatsApp

Nueva tabla `whatsapp_cleanup_config`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `whatsapp_id` | FK → whatsapp | PK, instancia de WhatsApp |
| `cleanup_enabled` | boolean | ¿Habilitar limpieza automática? |
| `cleanup_days` | integer | Eliminar archivos más antiguos de X días |
| `exclude_chats` | json | Lista de chat IDs excluidos de limpieza |
| `include_only_chats` | json | Si no está vacío, solo limpiar estos chats |
| `force_cleanup` | boolean | Ignorar retenciones individuales de mensajes |
| `max_agent_retention_days` | integer | Máximo de días que un agent puede retener un asset |

**Reglas de limpieza:**
1. Si `cleanup_enabled = false` → no se limpia nada
2. Si `force_cleanup = true` → se limpia todo según `cleanup_days`, ignorando excepciones
3. Si `include_only_chats` tiene elementos → solo limpiar esos chats
4. Si `exclude_chats` tiene elementos → excluir esos chats
5. Retención individual de mensaje tiene prioridad (excepto si `force_cleanup = true`)

#### Configuración a Nivel de Chat

Nueva tabla `chat_config`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK |
| `whatsapp_id` | FK → whatsapp | Instancia de WhatsApp |
| `chat_id` | text | ID del chat |
| `custom_name` | text | Nombre personalizado del chat |
| `cleanup_excluded` | boolean | Excluir de limpieza automática |
| `cleanup_included` | boolean | Incluir en limpieza (prioridad sobre exclusión global) |

#### Retención a Nivel de Mensaje

Nuevos campos en `message`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `media_retention_until` | timestamp | Retener media hasta esta fecha (null = usar política global) |
| `media_retention_set_by` | FK → user | Usuario que configuró la retención |

---

## 3. Tracking de Origen de Mensajes

### 3.1 Nuevos Campos en `message`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `sent_from_platform` | boolean | ¿Fue enviado desde la plataforma WAPI? |
| `sent_by_user_id` | FK → user \| null | Usuario que envió (si fue desde plataforma) |
| `sent_by_connection_id` | FK → connection \| null | Conexión que envió (si fue via API) |

### 3.2 Lógica de Tracking

- **Mensaje recibido de WhatsApp**: `sent_from_platform = false`, ambos campos null
- **Mensaje enviado desde UI de WAPI**: `sent_from_platform = true`, `sent_by_user_id = usuario actual`
- **Mensaje enviado via API/Conexión**: `sent_from_platform = true`, `sent_by_connection_id = conexión usada`

---

## 4. Envío de Assets

### 4.1 Tipos de Media Soportados

| Tipo | Formato | Descripción |
|------|---------|-------------|
| image | `{ image: { url }, caption? }` | Imágenes (JPG, PNG, WebP) |
| video | `{ video: { url }, caption? }` | Videos (MP4) |
| audio | `{ audio: { url }, ptt? }` | Audio (MP3, OGG). `ptt=true` para nota de voz |
| document | `{ document: { url }, fileName, mimetype? }` | Documentos (PDF, etc.) |
| sticker | `{ sticker: { url } }` | Stickers (WebP) |

### 4.2 Flujo de Envío desde Plataforma

1. Usuario sube archivo desde la UI
2. Archivo se guarda en storage (local o S3)
3. Se genera URL del archivo
4. Se envía mensaje via Baileys con la URL
5. Se guarda mensaje en DB con:
   - `sent_from_platform = true`
   - `sent_by_user_id = usuario actual`
   - `mediaUrl = ruta del archivo`

### 4.3 Flujo de Envío desde Conexión/API

1. API recibe request con `message` (formato Baileys)
2. Si incluye media con URL externa:
   - Descargar archivo
   - Guardar en storage
   - Actualizar URL en mensaje
3. Enviar via Baileys
4. Guardar en DB con:
   - `sent_from_platform = true`
   - `sent_by_connection_id = conexión usada`

---

## 5. Panel de Información de Chat

Al hacer click en el título de un chat abierto, se abre un panel lateral con pestañas:

### 5.1 Pestaña: Información

Muestra datos del chat:

| Campo | Descripción |
|-------|-------------|
| Nombre | Nombre del contacto/grupo (con opción de editar nombre personalizado) |
| Tipo | Personal / Grupo |
| ID | Chat ID (para debugging) |
| LID | Local ID |
| PN | Phone Number (si disponible) |
| Primer mensaje | Fecha del primer mensaje registrado |
| Total mensajes | Contador de mensajes |
| Total media | Contador de archivos |

**Configuración del Chat:**
- Toggle: Excluir de limpieza automática
- Toggle: Incluir en limpieza (si está excluido globalmente)
- Input: Nombre personalizado del chat

### 5.2 Pestaña: Links

Lista de mensajes que contienen URLs:
- Extracción automática de URLs del contenido
- Preview del link (si es posible)
- Click navega al mensaje en el chat
- Fecha y remitente

### 5.3 Pestaña: Assets

Galería de archivos multimedia:
- Grid de thumbnails (imágenes, videos, stickers)
- Lista para documentos y audios
- Filtros por tipo (imagen, video, audio, documento)
- Click navega al mensaje en el chat
- Opción de descarga directa
- Mostrar estado de retención

### 5.4 Pestaña: Notas

Sistema de notas colaborativas por chat:

#### Nueva tabla `chat_note`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | text | PK |
| `whatsapp_id` | FK → whatsapp | Instancia de WhatsApp |
| `chat_id` | text | ID del chat |
| `content` | text | Contenido de la nota |
| `created_by` | FK → user | Usuario que creó la nota |
| `created_at` | timestamp | Fecha de creación |
| `updated_at` | timestamp | Fecha de última edición |

**Funcionalidad:**
- Agregar nueva nota
- Editar nota propia
- Eliminar nota propia (managers/owners pueden eliminar cualquiera)
- Ver historial con autor y fecha

---

## 6. Resumen de Nuevas Tablas

```
platform_config (singleton)
├── allow_registration
├── allow_user_create_whatsapp
└── default_max_whatsapp_instances

user_config
├── user_id → user
├── can_create_whatsapp
└── max_whatsapp_instances

storage_config (singleton)
├── storage_type
├── s3_endpoint
├── s3_bucket
├── s3_region
├── s3_access_key
├── s3_secret_key
└── s3_public_url

whatsapp_member
├── whatsapp_id → whatsapp
├── user_id → user
├── role (owner/manager/agent)
├── created_at
└── created_by → user

whatsapp_cleanup_config
├── whatsapp_id → whatsapp
├── cleanup_enabled
├── cleanup_days
├── exclude_chats
├── include_only_chats
├── force_cleanup
└── max_agent_retention_days

chat_config
├── whatsapp_id → whatsapp
├── chat_id
├── custom_name
├── cleanup_excluded
└── cleanup_included

chat_note
├── whatsapp_id → whatsapp
├── chat_id
├── content
├── created_by → user
├── created_at
└── updated_at
```

## 7. Modificaciones a Tablas Existentes

### `message` (campos nuevos)

```diff
+ media_retention_until: timestamp
+ media_retention_set_by: FK → user
+ sent_from_platform: boolean
+ sent_by_user_id: FK → user (nullable)
+ sent_by_connection_id: FK → connection (nullable)
```

---

## 8. Prioridad de Implementación Sugerida

### Fase 1: Fundamentos
1. Sistema de roles de plataforma (admin/user)
2. Configuración global de plataforma
3. Sistema de roles de instancia (owner/manager/agent)

### Fase 2: Storage y Limpieza
4. Configuración de storage externo (S3)
5. Política de limpieza a nivel de instancia
6. Retención a nivel de mensaje

### Fase 3: Tracking y Envío
7. Tracking de origen de mensajes
8. Envío de assets desde plataforma
9. Envío de assets desde conexiones/API

### Fase 4: UI de Chat
10. Panel de información de chat
11. Pestaña de links
12. Pestaña de assets (galería)
13. Sistema de notas

---

## 9. Consideraciones Técnicas

### Seguridad
- Tokens de S3 deben estar encriptados en la base de datos
- Validar permisos en cada operación (server actions)
- Sanitizar nombres de archivo para prevenir path traversal

### Performance
- Índices en `whatsapp_member(whatsapp_id, user_id)`
- Índices en `chat_note(whatsapp_id, chat_id)`
- Paginación en galería de assets
- Lazy loading de thumbnails

### Migración
- Script de migración para asignar rol "owner" al `userId` actual de cada instancia
- Migración de archivos locales a S3 (si se cambia storage)

### Cron Jobs
- Job de limpieza de archivos (ejecutar diariamente)
- Verificar `cleanup_enabled`, `cleanup_days`, exclusiones
- Log de archivos eliminados para auditoría
