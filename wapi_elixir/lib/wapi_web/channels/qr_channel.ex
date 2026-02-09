defmodule WapiWeb.QrChannel do
  use WapiWeb, :channel
  require Logger

  @impl true
  def join("qr:" <> whatsapp_id, _params, socket) do
    user_id = socket.assigns.user_id

    if Wapi.Authorization.can_manage_whatsapp?(user_id, whatsapp_id) do
      Phoenix.PubSub.subscribe(Wapi.PubSub, "qr:#{whatsapp_id}")
      Phoenix.PubSub.subscribe(Wapi.PubSub, "session:#{whatsapp_id}")

      # Send current QR if available
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

  def handle_info(%{status: status} = data, socket) do
    push(socket, "status_change", %{status: status, message: data[:message]})
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end
end
