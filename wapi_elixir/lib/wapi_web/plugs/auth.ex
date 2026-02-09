defmodule WapiWeb.Plugs.Auth do
  @moduledoc "Plug that authenticates requests via Bearer token against better-auth session table."
  import Plug.Conn
  import Ecto.Query

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, user_id} <- validate_token(token) do
      assign(conn, :user_id, user_id)
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{error: "Unauthorized"})
        |> halt()
    end
  end

  defp validate_token(token) do
    query =
      from s in Wapi.Schema.Session,
        where: s.token == ^token and s.expires_at > ^DateTime.utc_now(),
        select: s.user_id

    case Wapi.Repo.one(query) do
      nil -> :error
      user_id -> {:ok, user_id}
    end
  end
end
