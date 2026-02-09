defmodule Wapi.Telemetry do
  use Supervisor
  import Telemetry.Metrics

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  @impl true
  def init(_arg) do
    children = [
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  def metrics do
    [
      # Phoenix
      summary("phoenix.endpoint.start.system_time",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.endpoint.stop.duration",
        unit: {:native, :millisecond}
      ),
      summary("phoenix.router_dispatch.stop.duration",
        tags: [:route],
        unit: {:native, :millisecond}
      ),

      # Database
      summary("wapi.repo.query.total_time",
        unit: {:native, :millisecond},
        description: "Total Ecto query time"
      ),
      summary("wapi.repo.query.decode_time",
        unit: {:native, :millisecond}
      ),
      summary("wapi.repo.query.query_time",
        unit: {:native, :millisecond}
      ),
      summary("wapi.repo.query.queue_time",
        unit: {:native, :millisecond}
      ),

      # VM
      summary("vm.memory.total", unit: {:byte, :megabyte}),
      summary("vm.total_run_queue_lengths.total"),
      summary("vm.total_run_queue_lengths.cpu"),
      summary("vm.total_run_queue_lengths.io"),

      # Broadway pipeline
      counter("wapi.pipeline.message.processed"),
      counter("wapi.pipeline.message.failed"),

      # Sender
      counter("wapi.sender.message_sent"),
      counter("wapi.sender.message_failed"),

      # Sessions
      last_value("wapi.sessions.active.count"),

      # Webhooks
      counter("wapi.webhook.delivered"),
      counter("wapi.webhook.failed")
    ]
  end

  defp periodic_measurements do
    [
      {__MODULE__, :active_sessions_count, []}
    ]
  end

  def active_sessions_count do
    count =
      try do
        Wapi.WhatsApp.SessionSupervisor.list_sessions()
        |> length()
      rescue
        _ -> 0
      end

    :telemetry.execute([:wapi, :sessions, :active], %{count: count}, %{})
  end
end
