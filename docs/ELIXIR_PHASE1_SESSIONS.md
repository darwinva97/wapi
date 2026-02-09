# Fase 1: Migracion de Gestion de Sesiones WhatsApp

## Objetivo

Reemplazar el sistema actual de gestion de sesiones WhatsApp (basado en `Map` global, `Set` de locks, y `setTimeout`) por un arbol de supervision Elixir/OTP con GenServers individuales por sesion, supervisados por un DynamicSupervisor.

---

## Problemas Actuales en `src/lib/whatsapp.ts`

### 1. Map Global sin Persistencia (lineas 70-95)

```typescript
// Global map to store active connections
// In a production environment with multiple instances, this needs Redis or similar.
const globalForWhatsapp = global as unknown as {
  whatsappSessions: Map<string, WASocket>;
  whatsappQrs: Map<string, string>;
  whatsappEvents: EventEmitter;
};

const sessions = globalForWhatsapp.whatsappSessions || new Map<string, WASocket>();
const qrs = globalForWhatsapp.whatsappQrs || new Map<string, string>();
```

**Problemas:**
- Las sesiones se pierden al reiniciar el servidor
- El propio codigo admite que no escala (`needs Redis or similar`)
- HMR en desarrollo destruye las sesiones
- No hay forma de inspeccionar el estado de las sesiones

### 2. Locks Manuales con Set (linea 39)

```typescript
const connectingLocks = new Set<string>();
```

**Problemas:**
- Race conditions posibles en operaciones async
- No es distribuido (multiples instancias pueden conectar la misma sesion)
- No hay timeout en los locks (si el proceso muere, el lock queda)

### 3. Reconexion con setTimeout (lineas 1247, 1258)

```typescript
// Reconnect after clearing - will require new QR scan
setTimeout(() => connectToWhatsApp(whatsappId), 2000);
// ...
// Reconnect with exponential backoff
setTimeout(() => connectToWhatsApp(whatsappId), 3000);
```

**Problemas:**
- No hay backoff exponencial real (siempre 2-3 segundos fijos)
- `setTimeout` no es supervisado; si falla, no se reintenta
- No hay limite de reintentos
- No hay circuito de proteccion (circuit breaker)

### 4. Manejo de Errores de Sesion (lineas 42-68)

```typescript
function clearCorruptedSession(whatsappId: string): void {
  const sessionPath = path.join(SESSIONS_DIR, whatsappId);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  sessions.delete(whatsappId);
  qrs.delete(whatsappId);
  connectingLocks.delete(whatsappId);
}
```

**Problemas:**
- Eliminacion de archivos sincrona en el thread principal
- No hay logs estructurados para diagnostico
- No se notifica a los clientes conectados de forma confiable

---

## Diseno con GenServer + DynamicSupervisor

### Supervision Tree Propuesto

```
Wapi.Application
├── Wapi.WhatsApp.SessionSupervisor (DynamicSupervisor)
│   ├── Wapi.WhatsApp.SessionServer "whatsapp-id-1" (GenServer)
│   ├── Wapi.WhatsApp.SessionServer "whatsapp-id-2" (GenServer)
│   └── ... (una por cuenta WhatsApp activa)
├── Wapi.WhatsApp.SessionRegistry (Registry)
├── Wapi.WhatsApp.NodeBridge (Port/GenServer - comunicacion con Baileys)
└── Phoenix.PubSub (para eventos entre procesos)
```

### SessionServer (GenServer)

Cada cuenta WhatsApp tiene su propio proceso GenServer con estado aislado:

```elixir
defmodule Wapi.WhatsApp.SessionServer do
  use GenServer, restart: :transient

  # Estado del GenServer
  defstruct [
    :whatsapp_id,       # ID de la cuenta WhatsApp
    :status,            # :disconnected | :connecting | :connected | :qr_pending
    :qr_code,           # String del QR actual (nil si conectado)
    :phone_number,      # Numero de telefono asociado
    :node_port,         # Puerto/referencia al proceso Node.js
    :retry_count,       # Contador de reintentos de conexion
    :max_retries,       # Maximo de reintentos (default: 10)
    :retry_backoff_ms,  # Backoff actual en ms
    :connected_at,      # DateTime de ultima conexion exitosa
    :last_error,        # Ultimo error registrado
    :session_path,      # Ruta a archivos de sesion en disco
  ]

  @initial_backoff_ms 1_000
  @max_backoff_ms 60_000
  @max_retries 10

  ## API Publica

  def start_link(whatsapp_id) do
    GenServer.start_link(__MODULE__, whatsapp_id,
      name: via_tuple(whatsapp_id)
    )
  end

  def connect(whatsapp_id), do: GenServer.call(via_tuple(whatsapp_id), :connect)
  def disconnect(whatsapp_id), do: GenServer.call(via_tuple(whatsapp_id), :disconnect)
  def get_status(whatsapp_id), do: GenServer.call(via_tuple(whatsapp_id), :get_status)
  def get_qr(whatsapp_id), do: GenServer.call(via_tuple(whatsapp_id), :get_qr)
  def force_reset(whatsapp_id), do: GenServer.call(via_tuple(whatsapp_id), :force_reset)

  ## Callbacks

  @impl true
  def init(whatsapp_id) do
    state = %__MODULE__{
      whatsapp_id: whatsapp_id,
      status: :disconnected,
      retry_count: 0,
      max_retries: @max_retries,
      retry_backoff_ms: @initial_backoff_ms,
      session_path: Path.join("whatsapp_sessions", whatsapp_id)
    }

    # Intentar conexion automatica si hay sesion guardada
    if File.dir?(state.session_path) do
      send(self(), :auto_connect)
    end

    {:ok, state}
  end

  @impl true
  def handle_call(:connect, _from, %{status: :connected} = state) do
    {:reply, {:ok, :already_connected}, state}
  end

  def handle_call(:connect, _from, %{status: :connecting} = state) do
    {:reply, {:ok, :connecting}, state}
  end

  def handle_call(:connect, _from, state) do
    new_state = do_connect(state)
    {:reply, :ok, new_state}
  end

  def handle_call(:disconnect, _from, state) do
    new_state = do_disconnect(state)
    {:reply, :ok, new_state}
  end

  def handle_call(:get_status, _from, state) do
    {:reply, state.status, state}
  end

  def handle_call(:get_qr, _from, state) do
    {:reply, state.qr_code, state}
  end

  def handle_call(:force_reset, _from, state) do
    new_state = do_force_reset(state)
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_info(:auto_connect, state) do
    {:noreply, do_connect(state)}
  end

  def handle_info(:retry_connect, state) do
    if state.retry_count < state.max_retries do
      {:noreply, do_connect(state)}
    else
      # Maximo de reintentos alcanzado
      Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
        status: :max_retries_reached,
        message: "Maximo de reintentos alcanzado. Requiere intervencion manual."
      })
      {:noreply, %{state | status: :disconnected}}
    end
  end

  # Mensaje del NodeBridge: QR recibido
  def handle_info({:qr, qr_code}, state) do
    Phoenix.PubSub.broadcast(Wapi.PubSub, "qr:#{state.whatsapp_id}", %{
      type: :qr,
      qr: qr_code
    })
    {:noreply, %{state | status: :qr_pending, qr_code: qr_code}}
  end

  # Mensaje del NodeBridge: conexion abierta
  def handle_info(:connection_open, state) do
    Wapi.Repo.update_connection_status(state.whatsapp_id, true)

    Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
      status: :open
    })

    {:noreply, %{state |
      status: :connected,
      qr_code: nil,
      retry_count: 0,
      retry_backoff_ms: @initial_backoff_ms,
      connected_at: DateTime.utc_now()
    }}
  end

  # Mensaje del NodeBridge: conexion cerrada
  def handle_info({:connection_closed, reason}, state) do
    Wapi.Repo.update_connection_status(state.whatsapp_id, false)

    case reason do
      :logged_out ->
        do_force_reset(state)
        {:noreply, %{state | status: :disconnected}}

      :session_corrupted ->
        clear_corrupted_session(state)
        schedule_retry(state)
        {:noreply, %{state | status: :disconnected, retry_count: state.retry_count + 1}}

      _other ->
        schedule_retry(state)
        {:noreply, %{state |
          status: :disconnected,
          retry_count: state.retry_count + 1,
          last_error: reason
        }}
    end
  end

  ## Funciones Privadas

  defp do_connect(state) do
    # Enviar comando al NodeBridge para iniciar conexion Baileys
    Wapi.WhatsApp.NodeBridge.connect(state.whatsapp_id)
    %{state | status: :connecting}
  end

  defp do_disconnect(state) do
    Wapi.WhatsApp.NodeBridge.disconnect(state.whatsapp_id)
    Wapi.Repo.update_connection_status(state.whatsapp_id, false)
    %{state | status: :disconnected, qr_code: nil}
  end

  defp do_force_reset(state) do
    do_disconnect(state)
    clear_corrupted_session(state)
    %{state | status: :disconnected, qr_code: nil, retry_count: 0}
  end

  defp clear_corrupted_session(state) do
    if File.dir?(state.session_path) do
      File.rm_rf!(state.session_path)
    end
  end

  defp schedule_retry(state) do
    backoff = min(state.retry_backoff_ms * 2, @max_backoff_ms)
    Process.send_after(self(), :retry_connect, backoff)
    %{state | retry_backoff_ms: backoff}
  end

  defp via_tuple(whatsapp_id) do
    {:via, Registry, {Wapi.WhatsApp.SessionRegistry, whatsapp_id}}
  end
end
```

### SessionSupervisor (DynamicSupervisor)

```elixir
defmodule Wapi.WhatsApp.SessionSupervisor do
  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Inicia un nuevo SessionServer para una cuenta WhatsApp.
  Si ya existe, retorna el PID existente.
  """
  def start_session(whatsapp_id) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] ->
        {:ok, pid}

      [] ->
        child_spec = {Wapi.WhatsApp.SessionServer, whatsapp_id}
        DynamicSupervisor.start_child(__MODULE__, child_spec)
    end
  end

  @doc """
  Detiene el SessionServer de una cuenta WhatsApp.
  """
  def stop_session(whatsapp_id) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] ->
        DynamicSupervisor.terminate_child(__MODULE__, pid)

      [] ->
        {:error, :not_found}
    end
  end

  @doc """
  Lista todas las sesiones activas.
  """
  def list_sessions do
    Registry.select(Wapi.WhatsApp.SessionRegistry, [{{:"$1", :"$2", :_}, [], [{{:"$1", :"$2"}}]}])
  end
end
```

---

## Estrategia de Comunicacion con Baileys (Node.js Sidecar)

Baileys es una libreria Node.js y no tiene equivalente en Elixir. La estrategia es ejecutar Baileys como un microservicio Node.js (sidecar) que se comunica con Elixir via **Erlang Port** o **HTTP/WebSocket**.

### Opcion A: Erlang Port (Recomendada)

```
┌─────────────────────┐    stdin/stdout    ┌──────────────────────┐
│   Elixir             │◄────────────────►│   Node.js Sidecar     │
│   NodeBridge         │    (JSON-encoded  │   baileys-bridge.js   │
│   (GenServer)        │     messages)     │   - makeWASocket()    │
└─────────────────────┘                    │   - Event forwarding  │
                                           └──────────────────────┘
```

```elixir
defmodule Wapi.WhatsApp.NodeBridge do
  use GenServer

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @impl true
  def init(:ok) do
    port = Port.open(
      {:spawn, "node priv/baileys-bridge/index.js"},
      [:binary, :exit_status, {:line, 65_536}]
    )
    {:ok, %{port: port, pending: %{}}}
  end

  def connect(whatsapp_id) do
    GenServer.cast(__MODULE__, {:command, %{action: "connect", whatsapp_id: whatsapp_id}})
  end

  def disconnect(whatsapp_id) do
    GenServer.cast(__MODULE__, {:command, %{action: "disconnect", whatsapp_id: whatsapp_id}})
  end

  def send_message(whatsapp_id, jid, message) do
    GenServer.call(__MODULE__, {:command, %{
      action: "send_message",
      whatsapp_id: whatsapp_id,
      jid: jid,
      message: message
    }})
  end

  @impl true
  def handle_cast({:command, cmd}, %{port: port} = state) do
    json = Jason.encode!(cmd)
    Port.command(port, json <> "\n")
    {:noreply, state}
  end

  @impl true
  def handle_info({port, {:data, {:eol, line}}}, %{port: port} = state) do
    case Jason.decode(line) do
      {:ok, %{"event" => event, "whatsapp_id" => wid} = data} ->
        dispatch_event(wid, event, data)
        {:noreply, state}

      {:error, _} ->
        {:noreply, state}
    end
  end

  # Si el proceso Node.js muere, reiniciarlo
  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    Logger.error("Node.js bridge exited with status #{status}, restarting...")
    new_port = Port.open(
      {:spawn, "node priv/baileys-bridge/index.js"},
      [:binary, :exit_status, {:line, 65_536}]
    )
    {:noreply, %{state | port: new_port}}
  end

  defp dispatch_event(whatsapp_id, "qr", %{"qr" => qr}) do
    # Enviar al SessionServer correspondiente
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] -> send(pid, {:qr, qr})
      [] -> :ignore
    end
  end

  defp dispatch_event(whatsapp_id, "connection.open", _data) do
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] -> send(pid, :connection_open)
      [] -> :ignore
    end
  end

  defp dispatch_event(whatsapp_id, "connection.close", %{"reason" => reason}) do
    atom_reason = String.to_existing_atom(reason)
    case Registry.lookup(Wapi.WhatsApp.SessionRegistry, whatsapp_id) do
      [{pid, _}] -> send(pid, {:connection_closed, atom_reason})
      [] -> :ignore
    end
  end

  defp dispatch_event(whatsapp_id, "messages.upsert", data) do
    # Enviar al pipeline Broadway para procesamiento
    Wapi.Pipeline.MessageProducer.push(whatsapp_id, data)
  end

  defp dispatch_event(_whatsapp_id, event, _data) do
    Logger.debug("Unhandled event: #{event}")
  end
end
```

### Opcion B: HTTP/WebSocket

Para deployments donde los puertos Erlang no son practicos:

```
┌─────────────────────┐    WebSocket     ┌──────────────────────┐
│   Elixir             │◄──────────────►│   Node.js Sidecar     │
│   BridgeSocket       │   (ws://...)    │   baileys-bridge.js   │
│   (Phoenix Channel)  │                 │   + ws client         │
└─────────────────────┘                  └──────────────────────┘
```

---

## Esquema de Estado del GenServer

```
┌──────────────────────────────────────────────────────┐
│           SessionServer State Machine                 │
│                                                      │
│   :disconnected ──connect──► :connecting             │
│        ▲                         │                   │
│        │                    ┌────┴────┐              │
│    timeout/                 │         │              │
│    max_retries         qr_received  connected       │
│        │                   │         │              │
│        │                   ▼         ▼              │
│   :disconnected ◄── :qr_pending  :connected        │
│        ▲                             │              │
│        │                        close/error         │
│        └─────────────────────────────┘              │
│                                                      │
│   En cualquier estado:                               │
│     force_reset → :disconnected (limpia sesion)      │
│     logged_out  → :disconnected (limpia sesion)      │
│     corruption  → :disconnected (limpia + retry)     │
└──────────────────────────────────────────────────────┘
```

---

## Manejo de Errores y Reconexion

### Backoff Exponencial Real

A diferencia del `setTimeout` fijo actual, el GenServer implementa backoff exponencial:

| Reintento | Delay | Equivalente Actual |
|-----------|-------|--------------------|
| 1 | 1s | 2-3s (fijo) |
| 2 | 2s | 2-3s (fijo) |
| 3 | 4s | 2-3s (fijo) |
| 4 | 8s | 2-3s (fijo) |
| 5 | 16s | 2-3s (fijo) |
| 6 | 32s | 2-3s (fijo) |
| 7+ | 60s (max) | 2-3s (fijo) |

### Errores de Sesion (Bad MAC, Corruption)

El sistema actual detecta estos errores en `isSessionCorruptionError` (linea 54):

```typescript
const corruptionIndicators = [
  "Bad MAC", "decryption failed", "invalid key",
  "session not found", "no session", "corrupt", "HMAC",
];
```

En Elixir, esto se maneja con pattern matching en `handle_info`:

```elixir
def handle_info({:connection_closed, :session_corrupted}, state) do
  Logger.warning("Session corruption detected for #{state.whatsapp_id}")

  # 1. Limpiar archivos de sesion
  clear_corrupted_session(state)

  # 2. Notificar a clientes via PubSub
  Phoenix.PubSub.broadcast(Wapi.PubSub, "session:#{state.whatsapp_id}", %{
    status: :session_error,
    message: "Sesion corrupta (Bad MAC). Escanee QR nuevamente."
  })

  # 3. Programar reconexion (requerira nuevo QR)
  schedule_retry(state)

  {:noreply, %{state |
    status: :disconnected,
    retry_count: state.retry_count + 1
  }}
end
```

### Comparativa: Error Handling Actual vs. Propuesto

| Escenario | Actual (Node.js) | Propuesto (Elixir) |
|-----------|-----------------|-------------------|
| Crash en handler de mensajes | Try/catch, log, continua | Proceso aislado muere, supervisor reinicia |
| Bad MAC | clearCorruptedSession + setTimeout 2s | clear_session + backoff exponencial + PubSub |
| Logged out | clearCorruptedSession (sin retry) | clear_session, estado final :disconnected |
| Node.js OOM | Todo el servidor muere | Solo el proceso Baileys muere, Elixir reinicia |
| Multiples sesiones crashean | Una afecta a todas (single thread) | Cada una aislada en su proceso |
| Inspeccion en runtime | console.log | `:observer`, `Process.info/1`, `Registry.select/2` |

---

## Inicializacion al Arranque

Al iniciar la aplicacion Elixir, se deben reconectar las sesiones que estaban activas:

```elixir
defmodule Wapi.WhatsApp.SessionBootstrap do
  @doc """
  Inicia sesiones para todas las cuentas WhatsApp marcadas como conectadas en la DB.
  Se ejecuta al iniciar la aplicacion.
  """
  def start do
    whatsapps = Wapi.Repo.all(
      from w in Wapi.Schema.Whatsapp,
        where: w.connected == true or
               fragment("EXISTS(SELECT 1 FROM pg_stat_file(?))", ^"whatsapp_sessions/" <> w.id)
    )

    Enum.each(whatsapps, fn wa ->
      case Wapi.WhatsApp.SessionSupervisor.start_session(wa.id) do
        {:ok, _pid} ->
          Logger.info("Auto-started session for #{wa.id}")

        {:error, reason} ->
          Logger.error("Failed to auto-start session for #{wa.id}: #{inspect(reason)}")
      end
    end)
  end
end
```

---

## Testing

```elixir
defmodule Wapi.WhatsApp.SessionServerTest do
  use ExUnit.Case, async: true

  test "inicia en estado disconnected" do
    {:ok, pid} = Wapi.WhatsApp.SessionServer.start_link("test-id")
    assert Wapi.WhatsApp.SessionServer.get_status("test-id") == :disconnected
  end

  test "transicion a connecting al conectar" do
    {:ok, pid} = Wapi.WhatsApp.SessionServer.start_link("test-id")
    :ok = Wapi.WhatsApp.SessionServer.connect("test-id")
    assert Wapi.WhatsApp.SessionServer.get_status("test-id") == :connecting
  end

  test "backoff exponencial en reconexiones" do
    # Simular multiples desconexiones y verificar delays crecientes
    {:ok, pid} = Wapi.WhatsApp.SessionServer.start_link("test-id")
    send(pid, {:connection_closed, :unknown})
    assert_receive :retry_connect, 2_000  # 1s backoff
    send(pid, {:connection_closed, :unknown})
    assert_receive :retry_connect, 3_000  # 2s backoff
  end

  test "force_reset limpia sesion y estado" do
    {:ok, pid} = Wapi.WhatsApp.SessionServer.start_link("test-id")
    :ok = Wapi.WhatsApp.SessionServer.force_reset("test-id")
    assert Wapi.WhatsApp.SessionServer.get_status("test-id") == :disconnected
  end
end
```

---

## Criterios de Exito

- [ ] Cada sesion WhatsApp corre en su propio proceso aislado
- [ ] Un crash en una sesion no afecta a las demas
- [ ] Reconexion con backoff exponencial real (1s → 60s max)
- [ ] Limite de reintentos configurable (default: 10)
- [ ] Estado de sesiones inspeccionable via `:observer` o API
- [ ] Sesiones se reconectan automaticamente al reiniciar el servidor
- [ ] Errores de corruption (Bad MAC) se manejan con limpieza automatica
- [ ] Comunicacion confiable con Baileys via Port o WebSocket
