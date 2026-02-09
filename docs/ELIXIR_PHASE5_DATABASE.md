# Fase 5: Migracion Opcional de Drizzle ORM a Ecto

## Objetivo

Migrar los schemas de Drizzle ORM (`src/db/schema/*.ts`) a Ecto schemas con changesets, reemplazando la validacion manual dispersa en los handlers por validacion centralizada y declarativa. Esta fase es **opcional** ya que Elixir puede conectarse a la misma base de datos PostgreSQL que usa Drizzle.

---

## Schema Actual (Drizzle ORM)

### Estructura de Archivos

```
src/db/schema/
├── user.ts        → userTable, sessionTable, accountTable, verificationTable
├── whatsapp.ts    → whatsappTable, contactTable, groupTable, connectionTable,
│                    messageTable, reactionTable, pollTable, pollVoteTable
├── config.ts      → platformConfigTable, userConfigTable, whatsappMemberTable,
│                    whatsappCleanupConfigTable, chatConfigTable, chatNoteTable,
│                    storageConfigTable
└── index.ts       → Re-exports
```

### Configuracion Drizzle (`drizzle.config.ts`)

```typescript
export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

---

## Mapping de Schema: Drizzle → Ecto

### Tabla `whatsapp`

**Drizzle** (`src/db/schema/whatsapp.ts:4-15`):
```typescript
export const whatsappTable = pgTable("whatsapp", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  slug: text("slug").notNull().unique(),
  phoneNumber: text("phone_number").notNull().unique(),
  connected: boolean("connected").notNull(),
  enabled: boolean("enabled").notNull(),
});
```

**Ecto**:
```elixir
defmodule Wapi.Schema.Whatsapp do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "whatsapp" do
    field :name, :string
    field :description, :string
    field :slug, :string
    field :phone_number, :string
    field :connected, :boolean, default: false
    field :enabled, :boolean, default: true

    belongs_to :user, Wapi.Schema.User, type: :string
    has_many :contacts, Wapi.Schema.Contact
    has_many :groups, Wapi.Schema.Group
    has_many :connections, Wapi.Schema.Connection
    has_many :messages, Wapi.Schema.Message
    has_one :cleanup_config, Wapi.Schema.WhatsappCleanupConfig
    has_many :members, Wapi.Schema.WhatsappMember
  end

  def changeset(whatsapp, attrs) do
    whatsapp
    |> cast(attrs, [:id, :user_id, :name, :description, :slug, :phone_number, :connected, :enabled])
    |> validate_required([:id, :user_id, :name, :slug, :phone_number])
    |> unique_constraint(:slug)
    |> unique_constraint(:phone_number)
    |> foreign_key_constraint(:user_id)
    |> validate_format(:slug, ~r/^[a-z0-9\-]+$/, message: "solo letras minusculas, numeros y guiones")
    |> validate_format(:phone_number, ~r/^\+?\d{10,15}$/, message: "formato de telefono invalido")
  end
end
```

### Tabla `contact`

**Drizzle** (`src/db/schema/whatsapp.ts:17-27`):
```typescript
export const contactTable = pgTable("contact", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id").notNull().references(...),
  name: text("name").notNull(),
  pushName: text("push_name").notNull(),
  lid: text("lid").notNull(),
  pn: text("pn").notNull(),
  description: text("description"),
});
```

**Ecto**:
```elixir
defmodule Wapi.Schema.Contact do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "contact" do
    field :name, :string
    field :push_name, :string
    field :lid, :string
    field :pn, :string
    field :description, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
  end

  def changeset(contact, attrs) do
    contact
    |> cast(attrs, [:id, :whatsapp_id, :name, :push_name, :lid, :pn, :description])
    |> validate_required([:id, :whatsapp_id, :name, :push_name])
    |> foreign_key_constraint(:whatsapp_id)
  end

  @doc "Changeset para upsert de contacto (desde contacts.upsert o messaging-history.set)"
  def upsert_changeset(contact, attrs) do
    contact
    |> cast(attrs, [:name, :push_name, :lid, :pn])
    |> validate_lid_format(:lid)
    |> validate_pn_format(:pn)
  end

  defp validate_lid_format(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      if value == "" || String.contains?(value, "@lid") do
        []
      else
        [{field, "debe contener @lid o estar vacio"}]
      end
    end)
  end

  defp validate_pn_format(changeset, field) do
    validate_change(changeset, field, fn _, value ->
      if value == "" || String.contains?(value, "@s.whatsapp.net") do
        []
      else
        [{field, "debe contener @s.whatsapp.net o estar vacio"}]
      end
    end)
  end
end
```

### Tabla `message`

**Drizzle** (`src/db/schema/whatsapp.ts:57-85`):
```typescript
export const messageTable = pgTable("message", {
  id: text("id").primaryKey(),
  whatsappId: text("whatsapp_id").notNull().references(...),
  chatId: text("chat_id").notNull(),
  chatType: text("chat_type").notNull(),
  senderId: text("sender_id").notNull(),
  content: jsonb("content"),
  body: text("body"),
  timestamp: timestamp("timestamp", { mode: "date", withTimezone: true }).notNull(),
  fromMe: boolean("from_me").notNull(),
  messageType: text("message_type").notNull().default('text'),
  mediaUrl: text("media_url"),
  mediaMetadata: jsonb("media_metadata"),
  ackStatus: integer("ack_status").notNull().default(0),
  fileName: text("file_name"),
  mediaRetentionUntil: timestamp("media_retention_until", ...),
  mediaRetentionSetBy: text("media_retention_set_by").references(...),
  sentFromPlatform: boolean("sent_from_platform").default(false),
  sentByUserId: text("sent_by_user_id").references(...),
  sentByConnectionId: text("sent_by_connection_id").references(...),
});
```

**Ecto**:
```elixir
defmodule Wapi.Schema.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "message" do
    field :chat_id, :string
    field :chat_type, :string
    field :sender_id, :string
    field :content, :map  # jsonb
    field :body, :string
    field :timestamp, :utc_datetime_usec
    field :from_me, :boolean, default: false
    field :message_type, :string, default: "text"
    field :media_url, :string
    field :media_metadata, :map  # jsonb
    field :ack_status, :integer, default: 0
    field :file_name, :string
    field :media_retention_until, :utc_datetime_usec
    field :sent_from_platform, :boolean, default: false

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :media_retention_set_by_user, Wapi.Schema.User,
      foreign_key: :media_retention_set_by, type: :string
    belongs_to :sent_by_user, Wapi.Schema.User,
      foreign_key: :sent_by_user_id, type: :string
    belongs_to :sent_by_connection, Wapi.Schema.Connection,
      foreign_key: :sent_by_connection_id, type: :string

    has_many :reactions, Wapi.Schema.Reaction
  end

  @valid_types ~w(text image video audio sticker document location)
  @valid_chat_types ~w(group personal)

  def changeset(message, attrs) do
    message
    |> cast(attrs, [
      :id, :whatsapp_id, :chat_id, :chat_type, :sender_id, :content, :body,
      :timestamp, :from_me, :message_type, :media_url, :media_metadata,
      :ack_status, :file_name, :media_retention_until, :media_retention_set_by,
      :sent_from_platform, :sent_by_user_id, :sent_by_connection_id
    ])
    |> validate_required([:id, :whatsapp_id, :chat_id, :chat_type, :sender_id, :timestamp])
    |> validate_inclusion(:message_type, @valid_types)
    |> validate_inclusion(:chat_type, @valid_chat_types)
    |> validate_inclusion(:ack_status, 0..3)
    |> foreign_key_constraint(:whatsapp_id)
  end

  @doc "Changeset para actualizar ack status"
  def ack_changeset(message, ack_status) do
    message
    |> change(ack_status: ack_status)
    |> validate_inclusion(:ack_status, 0..3)
  end

  @doc "Changeset para actualizar/remover media"
  def media_changeset(message, attrs) do
    message
    |> cast(attrs, [:media_url, :media_metadata])
  end
end
```

### Tabla `connection`

**Ecto**:
```elixir
defmodule Wapi.Schema.Connection do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "connection" do
    field :name, :string
    field :description, :string
    field :slug, :string
    field :receiver_enabled, :boolean, default: false
    field :receiver_request, :map  # jsonb
    field :receiver_filter, :map   # jsonb
    field :sender_enabled, :boolean, default: false
    field :sender_token, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
  end

  def changeset(connection, attrs) do
    connection
    |> cast(attrs, [:id, :whatsapp_id, :name, :description, :slug,
                    :receiver_enabled, :receiver_request, :receiver_filter,
                    :sender_enabled, :sender_token])
    |> validate_required([:id, :whatsapp_id, :name, :slug])
    |> unique_constraint(:slug)
    |> validate_format(:slug, ~r/^[a-z0-9\-]+$/)
    |> validate_receiver_request()
  end

  defp validate_receiver_request(changeset) do
    validate_change(changeset, :receiver_request, fn _, value ->
      case value do
        %{"url" => url} when is_binary(url) and url != "" ->
          if String.starts_with?(url, "http") do
            []
          else
            [{:receiver_request, "url debe empezar con http:// o https://"}]
          end
        nil ->
          []
        _ ->
          [{:receiver_request, "debe contener un campo 'url' valido"}]
      end
    end)
  end
end
```

### Tablas User, Session, Account

**Ecto**:
```elixir
defmodule Wapi.Schema.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "user" do
    field :name, :string
    field :email, :string
    field :email_verified, :boolean, default: false
    field :image, :string
    field :role, :string
    field :banned, :boolean, default: false
    field :ban_reason, :string
    field :ban_expires, :utc_datetime_usec

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)

    has_many :sessions, Wapi.Schema.Session
    has_many :accounts, Wapi.Schema.Account
    has_many :whatsapps, Wapi.Schema.Whatsapp
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:id, :name, :email, :email_verified, :image, :role, :banned, :ban_reason, :ban_expires])
    |> validate_required([:id, :name, :email])
    |> unique_constraint(:email)
    |> validate_format(:email, ~r/@/)
  end
end
```

---

## Changesets vs Validacion Manual Actual

### Ejemplo: Creacion de Contacto

**Actual** (en `src/lib/whatsapp.ts:418-444`, sin validacion):
```typescript
// No hay validacion de formato de lid/pn
// No hay validacion de longitud de name
// No hay validacion de unicidad (depende del check previo)
await db.insert(contactTable).values({
  id: crypto.randomUUID(),
  whatsappId,
  name: displayName,
  pushName: realPushName || displayName,
  lid: normalized.lid || "",
  pn: normalized.pn || "",
  description: "",
});
```

**Propuesto** (con Ecto Changeset):
```elixir
def create_contact(whatsapp_id, attrs) do
  %Contact{}
  |> Contact.changeset(Map.merge(attrs, %{
    id: Ecto.UUID.generate(),
    whatsapp_id: whatsapp_id
  }))
  |> Repo.insert(on_conflict: :nothing)
end
```

El changeset automaticamente:
- Valida campos requeridos
- Valida formato de lid (`@lid`) y pn (`@s.whatsapp.net`)
- Valida constraints de foreign key
- Retorna `{:ok, contact}` o `{:error, changeset}` con errores legibles

### Ejemplo: Actualizacion de Contacto

**Actual** (en `src/lib/whatsapp.ts:446-477`, con logica dispersa):
```typescript
const updateData: Partial<{ name: string; pushName: string; lid: string; pn: string }> = {};
if (normalized.contactName) updateData.name = normalized.contactName;
if (normalized.notifyName || normalized.verifiedName) {
  updateData.pushName = normalized.notifyName || normalized.verifiedName || existing.pushName;
}
if (normalized.lid && (!existing.lid || !existing.lid.includes("@lid"))) {
  updateData.lid = normalized.lid;
}
// ... mas logica condicional
if (Object.keys(updateData).length > 0) {
  await db.update(contactTable).set(updateData).where(eq(contactTable.id, existing.id));
}
```

**Propuesto**:
```elixir
def update_contact_from_upsert(existing, new_data) do
  existing
  |> Contact.upsert_changeset(new_data)
  |> Repo.update()
end
```

La logica de "solo actualizar si el nuevo valor es mejor" se encapsula en el changeset.

---

## Ecto.Multi para Transacciones Atomicas

### Problema Actual

En el handler `messages.upsert`, multiples operaciones de DB no son atomicas:

```typescript
// Estas operaciones pueden fallar parcialmente:
await db.insert(messageTable).values({...});           // 1. Insertar mensaje
await db.insert(pollTable).values({...});              // 2. Insertar poll
whatsappEvents.emit(`new-message-${chatId}`, {...});   // 3. Emitir evento
```

Si la insercion del poll falla, el mensaje ya esta en la DB pero sin datos del poll.

### Solucion con Ecto.Multi

```elixir
def insert_poll_message(whatsapp_id, msg_data, poll_data) do
  Ecto.Multi.new()
  |> Ecto.Multi.insert(:message, Message.changeset(%Message{}, msg_data))
  |> Ecto.Multi.insert(:poll, Poll.changeset(%Poll{}, poll_data))
  |> Ecto.Multi.run(:broadcast, fn _repo, %{message: message} ->
    Phoenix.PubSub.broadcast(Wapi.PubSub, "chat:#{message.chat_id}", %{
      event: "new_message",
      payload: message
    })
    {:ok, :broadcasted}
  end)
  |> Repo.transaction()
  |> case do
    {:ok, %{message: message, poll: poll}} ->
      {:ok, message, poll}

    {:error, :message, changeset, _} ->
      {:error, {:message_insert_failed, changeset}}

    {:error, :poll, changeset, _} ->
      {:error, {:poll_insert_failed, changeset}}
  end
end
```

### Otros Casos para Multi

```elixir
# Insertar reaccion (verificar que el mensaje target existe)
def insert_reaction(whatsapp_id, reaction_data) do
  Ecto.Multi.new()
  |> Ecto.Multi.one(:target_message,
    from(m in Message, where: m.id == ^reaction_data.message_id and m.whatsapp_id == ^whatsapp_id)
  )
  |> Ecto.Multi.insert(:reaction, fn %{target_message: _msg} ->
    Reaction.changeset(%Reaction{}, reaction_data)
  end)
  |> Repo.transaction()
end

# Force reset de sesion (actualizar DB + limpiar archivos)
def force_reset_session(whatsapp_id) do
  Ecto.Multi.new()
  |> Ecto.Multi.update(:whatsapp,
    from(w in Whatsapp, where: w.id == ^whatsapp_id)
    |> Repo.one!()
    |> Ecto.Changeset.change(connected: false)
  )
  |> Ecto.Multi.run(:cleanup, fn _repo, _ ->
    File.rm_rf(Path.join("whatsapp_sessions", whatsapp_id))
    {:ok, :cleaned}
  end)
  |> Repo.transaction()
end
```

---

## Migraciones con Rollback

### Estructura de Migraciones Ecto

```
priv/repo/migrations/
├── 20240101000000_create_users.exs
├── 20240101000001_create_whatsapps.exs
├── 20240101000002_create_contacts.exs
├── 20240101000003_create_groups.exs
├── 20240101000004_create_connections.exs
├── 20240101000005_create_messages.exs
├── 20240101000006_create_reactions.exs
├── 20240101000007_create_polls.exs
├── 20240101000008_create_config_tables.exs
└── 20240101000009_create_indexes.exs
```

### Ejemplo de Migracion con Rollback

```elixir
defmodule Wapi.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def up do
    create table(:message, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :chat_type, :text, null: false
      add :sender_id, :text, null: false
      add :content, :jsonb
      add :body, :text
      add :timestamp, :utc_datetime_usec, null: false
      add :from_me, :boolean, null: false, default: false
      add :message_type, :text, null: false, default: "text"
      add :media_url, :text
      add :media_metadata, :jsonb
      add :ack_status, :integer, null: false, default: 0
      add :file_name, :text
      add :media_retention_until, :utc_datetime_usec
      add :media_retention_set_by, references(:user, type: :text, on_delete: :nilify_all)
      add :sent_from_platform, :boolean, default: false
      add :sent_by_user_id, references(:user, type: :text, on_delete: :nilify_all)
      add :sent_by_connection_id, references(:connection, type: :text, on_delete: :nilify_all)
    end

    create index(:message, [:whatsapp_id])
    create index(:message, [:chat_id])
    create index(:message, [:whatsapp_id, :chat_id])
    create index(:message, [:timestamp])
  end

  def down do
    drop table(:message)
  end
end
```

### Comparativa: Drizzle vs Ecto Migraciones

| Aspecto | Drizzle (`drizzle-kit`) | Ecto |
|---------|------------------------|------|
| Generacion | `drizzle-kit generate` (auto desde schema) | `mix ecto.gen.migration` (manual) |
| Push directo | `drizzle-kit push` (peligroso en prod) | No existe equivalente (seguro) |
| Rollback | No soportado nativamente | `mix ecto.rollback` (cada migracion tiene `down`) |
| Estado | Tabla `__drizzle_migrations` | Tabla `schema_migrations` |
| SQL personalizado | Limitado | `execute/1` para SQL arbitrario |
| Data migrations | No soportado | `Ecto.Multi` en `up/0` |

---

## Connection Pooling

### Actual (Drizzle + pg)

```typescript
// src/db/index.ts (asumido)
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

### Propuesto (Ecto + Postgrex + DBConnection)

```elixir
# config/config.exs
config :wapi, Wapi.Repo,
  url: System.get_env("DATABASE_URL"),
  pool_size: 20,              # 20 conexiones en el pool
  queue_target: 50,           # Target queue time en ms
  queue_interval: 1_000,      # Intervalo de verificacion
  ssl: true,                  # SSL en produccion
  ssl_opts: [
    verify: :verify_peer,
    cacerts: :public_key.cacerts_get()
  ]

# config/prod.exs
config :wapi, Wapi.Repo,
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "20"),
  socket_options: [:inet6]    # IPv6 si aplica
```

### Ventajas del Pool de Ecto

| Aspecto | pg (Node.js) | DBConnection (Ecto) |
|---------|-------------|-------------------|
| Pool management | Basico | Avanzado (queue_target, queue_interval) |
| Connection checkout | Implicito | Explicito con timeout |
| Monitoring | No | Telemetry events integrados |
| Sandbox (tests) | No | `Ecto.Adapters.SQL.Sandbox` |
| Pool overflow | Error | Cola con backpressure |

---

## Nota sobre Coexistencia

Durante la migracion, **ambos sistemas (Drizzle y Ecto) pueden coexistir** accediendo a la misma base de datos PostgreSQL:

```
┌─────────────┐         ┌──────────┐         ┌─────────────┐
│  Next.js     │────────►│PostgreSQL│◄────────│  Elixir      │
│  (Drizzle)   │  Pool A │          │  Pool B │  (Ecto)      │
└─────────────┘         └──────────┘         └─────────────┘
```

**Consideraciones:**
- No ejecutar migraciones de ambos sistemas simultaneamente
- Drizzle usa `__drizzle_migrations`, Ecto usa `schema_migrations` (no interfieren)
- Ambos pueden leer/escribir las mismas tablas
- Ecto no necesita "crear" las tablas si ya existen (migraciones opcionales)

---

## Criterios de Exito

- [ ] Todos los schemas Drizzle mapeados a Ecto schemas
- [ ] Changesets con validacion para cada entidad
- [ ] Ecto.Multi para operaciones atomicas (poll + mensaje, reaccion + verificacion)
- [ ] Migraciones con `up` y `down` para cada tabla
- [ ] Connection pooling configurado con metricas
- [ ] Coexistencia Drizzle/Ecto verificada
- [ ] Tests de changeset para cada schema
