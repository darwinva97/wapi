defmodule Wapi.Pipeline.MessageProducer do
  @moduledoc """
  GenStage producer that buffers incoming WhatsApp events
  and feeds them to the Broadway pipeline with demand-based flow control.
  """
  use GenStage
  require Logger

  def start_link(_opts) do
    GenStage.start_link(__MODULE__, :ok, name: __MODULE__)
  end

  @doc "Push an event into the pipeline. Called from NodeBridge."
  def push(whatsapp_id, data) do
    GenStage.cast(__MODULE__, {:push, whatsapp_id, data})
  end

  @impl true
  def init(_args) do
    {:producer, %{queue: :queue.new(), demand: 0}}
  end

  @impl true
  def handle_cast({:push, whatsapp_id, data}, state) do
    event = %{
      whatsapp_id: whatsapp_id,
      data: data,
      received_at: System.monotonic_time(:millisecond)
    }

    queue = :queue.in(event, state.queue)
    dispatch_events(%{state | queue: queue}, [])
  end

  @impl true
  def handle_demand(incoming_demand, state) do
    dispatch_events(%{state | demand: state.demand + incoming_demand}, [])
  end

  defp dispatch_events(%{queue: queue, demand: demand} = state, events) when demand > 0 do
    case :queue.out(queue) do
      {{:value, event}, queue} ->
        dispatch_events(
          %{state | queue: queue, demand: demand - 1},
          [event | events]
        )

      {:empty, _queue} ->
        {:noreply, Enum.reverse(events), state}
    end
  end

  defp dispatch_events(state, events) do
    {:noreply, Enum.reverse(events), state}
  end
end
