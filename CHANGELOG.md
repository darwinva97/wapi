# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

---

## [Unreleased] - Próximas Características

### 🎯 Planeado

#### Receiver Filter Avanzado
Actualmente el `receiverFilter` solo soporta filtros JSON estáticos. Se planea extender esta funcionalidad:

- **Evaluación de JavaScript**: Permitir escribir código JavaScript que evalúe el mensaje entrante y retorne `true`/`false` para decidir si el webhook se dispara.
  ```javascript
  // Ejemplo: solo mensajes que contengan "pedido" y no sean míos
  (msg) => !msg.key.fromMe && msg.message?.conversation?.includes("pedido")
  ```

- **Plantillas de Petición HTTP**: Configurar una petición HTTP que se evalúe antes de enviar el webhook. Si la respuesta es truthy (status 2xx, body "true", etc.), el mensaje pasa.
  ```json
  {
    "type": "http",
    "url": "https://mi-api.com/should-forward",
    "method": "POST",
    "body": "{{message}}",
    "expectStatus": 200
  }
  ```

#### Más Ideas para el Roadmap

- **🖼️ Visualización de Media en Chats**
  - Ver imágenes, videos y stickers directamente en el chat del dashboard
  - Previews de documentos y audios
  - Galería de media por conversación
  - Descarga de archivos multimedia

- **📖 Documentación del Software**
  - Documentación técnica de la arquitectura
  - Guías de uso para usuarios finales
  - API Reference con OpenAPI/Swagger
  - Ejemplos de integración (n8n, Make, código)
  - Documentación inline con JSDoc/TSDoc

- **🔐 Sistema de Roles y Permisos (RBAC+)**
  
  Sistema de control de acceso basado en roles con permisos granulares. Los roles funcionan como **plantillas de permisos mínimos** que pueden extenderse con permisos adicionales por usuario.

  **Contextos de Permisos:**
  
  | Contexto | Descripción | Ejemplo |
  |----------|-------------|---------|
  | `system` | Permisos globales del sistema | Crear usuarios, ver métricas globales |
  | `whatsapp:{id}` | Permisos sobre un WhatsApp específico | Gestionar conexiones, ver chats |

  **Roles Predefinidos:**

  | Rol | Scope | Descripción |
  |-----|-------|-------------|
  | `owner` | Sistema | Control total. Puede todo. |
  | `admin` | Sistema | Puede crear/gestionar WhatsApps y usuarios |
  | `manager` | WhatsApp | Gestiona conexiones de un WhatsApp asignado |
  | `user` | WhatsApp | Acceso de solo lectura a chats asignados |

  **Permisos Granulares (Resources + Actions):**

  ```
  # Formato: resource:action
  
  # Sistema
  system:users:create
  system:users:read
  system:users:update
  system:users:delete
  system:whatsapps:create
  system:metrics:read
  
  # WhatsApp específico
  whatsapp:read
  whatsapp:update
  whatsapp:delete
  whatsapp:connections:create
  whatsapp:connections:read
  whatsapp:connections:update
  whatsapp:connections:delete
  whatsapp:chats:read
  whatsapp:chats:send
  whatsapp:contacts:read
  whatsapp:groups:read
  ```

  **Permisos de Recursos Específicos:**
  
  Además de los permisos por tipo, se pueden asignar permisos a recursos específicos:
  ```
  whatsapp:chats:read:*                    # Todos los chats
  whatsapp:chats:read:group:123456@g.us    # Solo este grupo
  whatsapp:chats:read:contact:519999@s.whatsapp.net  # Solo este contacto
  ```

  **Herencia de Roles:**
  ```
  owner   → admin + system:*
  admin   → manager + system:users:* + system:whatsapps:create
  manager → user + whatsapp:connections:* + whatsapp:chats:send
  user    → whatsapp:chats:read + whatsapp:contacts:read
  ```

  **Asignación de Permisos:**
  - Rol base (plantilla mínima)
  - Permisos adicionales por usuario
  - Permisos por contexto (sistema o WhatsApp específico)
  - Restricciones a recursos específicos (chats, grupos, contactos)

- **📊 Métricas y Estadísticas**
  - Logs de webhooks (exitosos/fallidos)
  - Tiempo de respuesta de webhooks

- **🔗 Transformadores de Payload**
  - Transformar el payload del webhook antes de enviarlo
  - Mapear campos a formato personalizado
  - Filtrar campos sensibles

- **⏰ Programación de Mensajes**
  - Enviar mensajes programados
  - Campañas de mensajes masivos
  - Rate limiting inteligente

- **🏷️ Etiquetas y Categorías**
  - Etiquetar conversaciones
  - Filtrar mensajes por etiquetas
  - Asignar conversaciones a usuarios

- **🔐 Seguridad Avanzada**
  - IP whitelist para webhooks
  - Rate limiting por conexión/token

- **📱 Multi-dispositivo**
  - Sincronización entre múltiples instancias
  - Failover automático

- **🤖 Integraciones**
  - Integración nativa con n8n
  - Integración con Zapier
  - SDK para Node.js/Python

- **💬 Respuestas Automáticas**
  - Autoresponder configurable
  - Horarios de atención
  - Mensajes de ausencia

---

## [0.1.0] - 2026-01-05

### Añadido
- 📱 Gestión de múltiples cuentas WhatsApp via QR
- 🔗 Sistema de conexiones (integraciones) bidireccionales
- 📤 Sender API para envío de mensajes
- 📥 Receiver webhooks para mensajes entrantes
- 👥 Gestión de contactos y grupos
- 💬 Chat en tiempo real con SSE
- 🔐 Autenticación con Better Auth
- 👤 Roles de usuario (admin/user)
- 📊 Dashboard de administración

### Stack
- Next.js 16 (App Router)
- SQLite/Turso con Drizzle ORM
- Baileys para WhatsApp
- Better Auth
- Tailwind CSS + shadcn/ui
