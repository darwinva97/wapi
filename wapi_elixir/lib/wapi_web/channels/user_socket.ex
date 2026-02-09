defmodule WapiWeb.UserSocket do
  use Phoenix.Socket

  channel "chat:*", WapiWeb.ChatChannel
  channel "qr:*", WapiWeb.QrChannel
  channel "session:*", WapiWeb.SessionChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    # Validate token against the database (better-auth session token)
    case validate_token(token) do
      {:ok, user_id} ->
        {:ok, assign(socket, :user_id, user_id)}

      :error ->
        :error
    end
  end

  def connect(_params, _socket, _connect_info) do
    :error
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"

  defp validate_token(token) do
    import Ecto.Query

    case Wapi.Repo.one(
           from(s in Wapi.Schema.Session,
             where: s.token == ^token and s.expires_at > ^DateTime.utc_now(),
             select: s.user_id
           )
         ) do
      nil -> :error
      user_id -> {:ok, user_id}
    end
  rescue
    _ -> :error
  end
end
