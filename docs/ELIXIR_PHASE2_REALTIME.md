# Fase 2: Migracion de SSE a Phoenix Channels

## Objetivo

Reemplazar los endpoints SSE (Server-Sent Events) basados en `EventEmitter` de Node.js por Phoenix Channels con PubSub distribuido, eliminando la limitacion de single-process y habilitando presencia de agentes.

---

## Problemas Actuales

### 1. EventEmitter con Limite de Listeners (`src/lib/whatsapp.ts:79-84`)

```typescript
if (!globalForWhatsapp.whatsappEvents) {
  globalForWhatsapp.whatsappEvents = new EventEmitter();
  globalForWhatsapp.whatsappEvents.setMaxListeners(100);
}
```

**Problemas:**
- Limite de 100 listeners concurrentes (100 clientes SSE maximo)
- Single-process: no funciona con multiples instancias del servidor
- Sin presencia: no se sabe que agentes estan viendo que chats
- Memoria: cada listener es una closure que consume memoria

### 2. SSE Chat Endpoint (`src/app/api/sse/chat/[chatId]/route.ts`)

```typescript
const stream = new ReadableStream({
  start(controller) {
    const listener = (data: Record<string, unknown>) => {
      sendEvent(data);
    };
    const eventName = `new-message-${decodedChatId}`;
    whatsappEvents.on(eventName, listener);
    // ...
  },
});
```

**Problemas:**
- Un stream por cliente = un listener por cliente en el EventEmitter
- Sin autenticacion (cualquiera puede suscribirse a un chatId)
- Sin heartbeat configurable (keep-alive cada 30s fijo)
- Sin reconexion inteligente del lado del servidor

### 3. QR SSE Endpoint (`src/app/api/whatsapp/[id]/qr/route.ts`)

```typescript
whatsappEvents.on(`qr-${id}`, onQr);
whatsappEvents.on(`status-${id}`, onStatus);
```

**Problemas:**
- Dos listeners por conexion QR (duplica uso del EventEmitter)
- Cleanup manual de listeners en `abort`
- try/catch para controllers ya cerrados (indicativo de race conditions)

### 4. Emision de Eventos en el Handler de Mensajes (`src/lib/whatsapp.ts:1055-1066`)

```typescript
whatsappEvents.emit(`new-message-${msg.key.remoteJid}`, {
  id: msg.key.id,
  body,
  timestamp: timestamp,
  // ...
});
```

**Problemas:**
- Si no hay listeners, el mensaje se pierde (fire-and-forget)
- No hay buffer para mensajes mientras el cliente se reconecta
- El emit es sincrono y bloquea el handler de mensajes

---

## Diseno con Phoenix PubSub + Channels

### Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    Phoenix Endpoint                           │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  WapiWeb.UserSocket  │  │  WapiWeb.ApiSocket           │  │
│  │  (Frontend React)    │  │  (Clientes API externos)     │  │
│  └──────────┬──────────┘  └──────────────┬───────────────┘  │
│             │                             │                  │
│  ┌──────────┴─────────────────────────────┴───────────────┐  │
│  │                    Channels                             │  │
│  │  ┌─────────────────┐  ┌──────────────────┐             │  │
│  │  │ ChatChannel      │  │ SessionChannel    │             │  │
│  │  │ "chat:{chatId}"  │  │ "session:{waId}"  │             │  │
│  │  └─────────────────┘  └──────────────────┘             │  │
│  │  ┌─────────────────┐  ┌──────────────────┐             │  │
│  │  │ QrChannel        │  │ PresenceChannel   │             │  │
│  │  │ "qr:{waId}"      │  │ "presence:{waId}" │             │  │
│  │  └─────────────────┘  └──────────────────┘             │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                   │
│  ┌───────────────────────┴────────────────────────────────┐  │
│  │              Phoenix.PubSub                             │  │
│  │  - Distribuido automaticamente en cluster               │  │
│  │  - Sin limite de suscriptores                           │  │
│  │  - Broadcast a todos los nodos                          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Topics y Estructura de Mensajes

| Topic | Proposito | Mensajes |
|-------|-----------|----------|
| `chat:{chatId}` | Mensajes nuevos y updates de un chat | `new_message`, `message_ack`, `typing` |
| `session:{whatsappId}` | Estado de conexion de una cuenta WA | `status_change`, `error` |
| `qr:{whatsappId}` | QR code para escanear | `qr_update`, `connected` |
| `presence:{whatsappId}` | Presencia de agentes | `join`, `leave`, `diff` |

### ChatChannel

```elixir
defmodule WapiWeb.ChatChannel do
  use WapiWeb, :channel

  alias Wapi.WhatsApp.SessionServer

  @impl true
  def join("chat:" <> chat_id, _params, socket) do
    # Verificar que el usuario tiene acceso a este chat
    whatsapp_id = socket.assigns.whatsapp_id

    if authorized?(socket.assigns.user_id, whatsapp_id) do
      # Trackear presencia del agente en este chat
      WapiWeb.Presence.track(socket, socket.assigns.user_id, %{
        online_at: System.system_time(:second),
        chat_id: chat_id
      })

      send(self(), :after_join)
      {:ok, assign(socket, :chat_id, chat_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    # Enviar presencia actual al nuevo cliente
    push(socket, "presence_state", WapiWeb.Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("send_message", %{"body" => body} = params, socket) do
    whatsapp_id = socket.assigns.whatsapp_id
    chat_id = socket.assigns.chat_id

    case SessionServer.send_message(whatsapp_id, chat_id, params) do
      {:ok, result} ->
        # El mensaje sera broadcasteado via PubSub cuando Baileys confirme
        {:reply, {:ok, %{message_id: result.id}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: reason}}, socket}
    end
  end

  @impl true
  def handle_in("typing", %{"is_typing" => is_typing}, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      is_typing: is_typing
    })
    {:noreply, socket}
  end

  # Recibir broadcasts del PubSub (enviados desde el pipeline Broadway)
  @impl true
  def handle_info(%{event: "new_message"} = msg, socket) do
    push(socket, "new_message", msg.payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "message_ack"} = msg, socket) do
    push(socket, "message_ack", msg.payload)
    {:noreply, socket}
  end

  defp authorized?(user_id, whatsapp_id) do
    # Verificar membership en la instancia WhatsApp
    Wapi.Authorization.can_access_whatsapp?(user_id, whatsapp_id)
  end
end
```

### QrChannel

```elixir
defmodule WapiWeb.QrChannel do
  use WapiWeb, :channel

  @impl true
  def join("qr:" <> whatsapp_id, _params, socket) do
    if authorized?(socket.assigns.user_id, whatsapp_id) do
      # Suscribirse a eventos QR
      Phoenix.PubSub.subscribe(Wapi.PubSub, "qr:#{whatsapp_id}")

      # Enviar QR actual si existe
      case Wapi.WhatsApp.SessionServer.get_qr(whatsapp_id) do
        nil -> :ok
        qr -> push(socket, "qr_update", %{qr: qr})
      end

      {:ok, assign(socket, :whatsapp_id, whatsapp_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(%{type: :qr, qr: qr}, socket) do
    push(socket, "qr_update", %{qr: qr})
    {:noreply, socket}
  end

  def handle_info(%{status: :open}, socket) do
    push(socket, "connected", %{})
    {:noreply, socket}
  end

  defp authorized?(user_id, whatsapp_id) do
    Wapi.Authorization.can_manage_whatsapp?(user_id, whatsapp_id)
  end
end
```

### SessionChannel

```elixir
defmodule WapiWeb.SessionChannel do
  use WapiWeb, :channel

  @impl true
  def join("session:" <> whatsapp_id, _params, socket) do
    if authorized?(socket.assigns.user_id, whatsapp_id) do
      Phoenix.PubSub.subscribe(Wapi.PubSub, "session:#{whatsapp_id}")

      # Enviar estado actual
      status = Wapi.WhatsApp.SessionServer.get_status(whatsapp_id)
      push(socket, "status_change", %{status: status})

      {:ok, assign(socket, :whatsapp_id, whatsapp_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(%{status: status} = data, socket) do
    push(socket, "status_change", data)
    {:noreply, socket}
  end

  defp authorized?(user_id, whatsapp_id) do
    Wapi.Authorization.can_access_whatsapp?(user_id, whatsapp_id)
  end
end
```

---

## Phoenix Presence para Tracking de Agentes

### Configuracion

```elixir
defmodule WapiWeb.Presence do
  use Phoenix.Presence,
    otp_app: :wapi,
    pubsub_server: Wapi.PubSub
end
```

### Datos de Presencia

Cada agente conectado a un chat genera un registro de presencia:

```elixir
# Cuando un agente se une a un chat:
WapiWeb.Presence.track(socket, user_id, %{
  online_at: System.system_time(:second),
  chat_id: chat_id,
  user_name: socket.assigns.user_name,
  role: socket.assigns.role  # "owner" | "manager" | "agent"
})
```

### Consultar Presencia

```elixir
# Ver que agentes estan en un chat especifico
def agents_in_chat(whatsapp_id, chat_id) do
  "presence:#{whatsapp_id}"
  |> WapiWeb.Presence.list()
  |> Enum.filter(fn {_user_id, %{metas: metas}} ->
    Enum.any?(metas, &(&1.chat_id == chat_id))
  end)
end

# Ver todos los agentes online para una instancia WhatsApp
def online_agents(whatsapp_id) do
  WapiWeb.Presence.list("presence:#{whatsapp_id}")
end
```

### Casos de Uso de Presencia

| Caso | Implementacion Actual | Con Phoenix Presence |
|------|----------------------|---------------------|
| Ver quien esta online | No existe | `Presence.list/1` |
| Saber quien ve un chat | No existe | `Presence.track/3` con `chat_id` |
| Indicador de "escribiendo" | No existe | Channel `typing` event |
| Asignar chats a agentes | Manual | Basado en presencia |
| Evitar respuestas duplicadas | No existe | Ver presencia antes de responder |

---

## Integracion con Frontend React

### Cliente Phoenix.js

Instalar el paquete:

```bash
npm install phoenix
```

### Hook de React para Channels

```typescript
// src/hooks/useChannel.ts
import { Socket, Channel, Presence } from "phoenix";
import { useEffect, useState, useCallback, useRef } from "react";

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000/socket";

// Singleton del socket
let socket: Socket | null = null;

function getSocket(token: string): Socket {
  if (!socket || !socket.isConnected()) {
    socket = new Socket(SOCKET_URL, {
      params: { token },
      reconnectAfterMs: (tries: number) =>
        [1000, 2000, 5000, 10000][tries - 1] || 30000,
    });
    socket.connect();
  }
  return socket;
}

// Hook para suscribirse a un chat
export function useChatChannel(chatId: string, token: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [presences, setPresences] = useState<Record<string, unknown>>({});
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    const sock = getSocket(token);
    const channel = sock.channel(`chat:${chatId}`, {});

    channel.on("new_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    channel.on("message_ack", (ack) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === ack.messageId ? { ...m, ackStatus: ack.ackStatus } : m
        )
      );
    });

    channel.on("typing", (data) => {
      // Manejar indicador de "escribiendo"
    });

    // Presencia
    const presence = new Presence(channel);
    presence.onSync(() => {
      setPresences(presence.list());
    });

    channel
      .join()
      .receive("ok", () => console.log(`Joined chat:${chatId}`))
      .receive("error", (err) => console.error("Join error:", err));

    channelRef.current = channel;

    return () => {
      channel.leave();
    };
  }, [chatId, token]);

  const sendMessage = useCallback(
    (body: string) => {
      channelRef.current?.push("send_message", { body });
    },
    []
  );

  const setTyping = useCallback(
    (isTyping: boolean) => {
      channelRef.current?.push("typing", { is_typing: isTyping });
    },
    []
  );

  return { messages, presences, sendMessage, setTyping };
}

// Hook para QR code
export function useQrChannel(whatsappId: string, token: string) {
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const sock = getSocket(token);
    const channel = sock.channel(`qr:${whatsappId}`, {});

    channel.on("qr_update", ({ qr }) => setQr(qr));
    channel.on("connected", () => {
      setConnected(true);
      setQr(null);
    });

    channel.join();
    return () => { channel.leave(); };
  }, [whatsappId, token]);

  return { qr, connected };
}

// Hook para estado de sesion
export function useSessionChannel(whatsappId: string, token: string) {
  const [status, setStatus] = useState<string>("unknown");

  useEffect(() => {
    const sock = getSocket(token);
    const channel = sock.channel(`session:${whatsappId}`, {});

    channel.on("status_change", (data) => setStatus(data.status));

    channel.join();
    return () => { channel.leave(); };
  }, [whatsappId, token]);

  return { status };
}
```

### Migracion del Componente Chat

Antes (SSE):

```tsx
// Actual: usa EventSource directamente
useEffect(() => {
  const es = new EventSource(`/api/sse/chat/${chatId}`);
  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    // actualizar estado
  };
  return () => es.close();
}, [chatId]);
```

Despues (Phoenix Channel):

```tsx
// Propuesto: usa hook personalizado
const { messages, presences, sendMessage, setTyping } = useChatChannel(
  chatId,
  sessionToken
);
```

---

## Comparativa SSE vs Phoenix Channels

| Aspecto | SSE (Actual) | Phoenix Channels (Propuesto) |
|---------|-------------|---------------------------|
| Direccion | Unidireccional (server→client) | Bidireccional |
| Escalabilidad | Single-process (max ~100) | Distribuido (millones) |
| Reconexion | Manual (EventSource retry) | Automatica (phoenix.js) |
| Autenticacion | No implementada | Token en connect + per-channel |
| Presencia | No existe | Phoenix.Presence built-in |
| Backpressure | No existe | Flow control en Channel |
| Multiplexing | 1 conexion HTTP por stream | 1 WebSocket, multiples channels |
| Protocolo | HTTP/1.1 chunked | WebSocket |
| Overhead por cliente | Alto (1 HTTP connection) | Bajo (1 WS, N topics) |

---

## Criterios de Exito

- [ ] Todos los endpoints SSE reemplazados por Channels
- [ ] Frontend React usa hooks de phoenix.js
- [ ] Presencia de agentes funcional en tiempo real
- [ ] Sin limite de clientes concurrentes (beyond 100)
- [ ] Funciona en multi-nodo (PubSub distribuido)
- [ ] Autenticacion en cada join de channel
- [ ] Indicador de "escribiendo" entre agentes
- [ ] Reconexion automatica transparente para el usuario
