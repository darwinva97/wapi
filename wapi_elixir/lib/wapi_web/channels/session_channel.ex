defmodule WapiWeb.SessionChannel do
  use WapiWeb, :channel

  @impl true
  def join("session:" <> whatsapp_id, _params, socket) do
    user_id = socket.assigns.user_id

    if Wapi.Authorization.can_access_whatsapp?(user_id, whatsapp_id) do
      Phoenix.PubSub.subscribe(Wapi.PubSub, "session:#{whatsapp_id}")

      # Send current status
      status = Wapi.WhatsApp.SessionServer.get_status(whatsapp_id)
      push(socket, "status_change", %{status: status})

      {:ok, assign(socket, :whatsapp_id, whatsapp_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_info(%{status: _status} = data, socket) do
    push(socket, "status_change", safe_map(data))
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  defp safe_map(%{__struct__: _} = struct), do: Map.from_struct(struct)
  defp safe_map(map) when is_map(map), do: map
end
