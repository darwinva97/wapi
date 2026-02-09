defmodule WapiWeb.ChatChannel do
  use WapiWeb, :channel
  require Logger

  @impl true
  def join("chat:" <> chat_id, %{"whatsapp_id" => whatsapp_id}, socket) do
    user_id = socket.assigns.user_id

    if Wapi.Authorization.can_access_whatsapp?(user_id, whatsapp_id) do
      # Subscribe to PubSub for this chat
      Phoenix.PubSub.subscribe(Wapi.PubSub, "chat:#{chat_id}")

      # Track presence
      WapiWeb.Presence.track(socket, user_id, %{
        online_at: System.system_time(:second),
        chat_id: chat_id
      })

      send(self(), :after_join)

      {:ok,
       socket
       |> assign(:chat_id, chat_id)
       |> assign(:whatsapp_id, whatsapp_id)}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  def join("chat:" <> _chat_id, _params, _socket) do
    {:error, %{reason: "missing whatsapp_id"}}
  end

  @impl true
  def handle_info(:after_join, socket) do
    push(socket, "presence_state", WapiWeb.Presence.list(socket))
    {:noreply, socket}
  end

  def handle_info(%{event: "new_message", payload: payload}, socket) do
    push(socket, "new_message", payload)
    {:noreply, socket}
  end

  def handle_info(%{event: "message_ack", payload: payload}, socket) do
    push(socket, "message_ack", payload)
    {:noreply, socket}
  end

  def handle_info(_msg, socket) do
    {:noreply, socket}
  end

  @impl true
  def handle_in("send_message", %{"body" => _body} = params, socket) do
    whatsapp_id = socket.assigns.whatsapp_id
    chat_id = socket.assigns.chat_id

    message = build_baileys_message(params)

    case Wapi.WhatsApp.SessionServer.send_message(whatsapp_id, chat_id, message) do
      {:ok, result} ->
        {:reply, {:ok, %{message_id: get_in(result, ["key", "id"])}}, socket}

      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  def handle_in("typing", %{"is_typing" => is_typing}, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      is_typing: is_typing
    })

    {:noreply, socket}
  end

  defp build_baileys_message(%{"body" => body}) do
    %{"text" => body}
  end
end
