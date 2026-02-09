defmodule WapiWeb.SessionController do
  use WapiWeb, :controller
  require Logger

  plug WapiWeb.Plugs.Auth

  alias Wapi.WhatsApp.{SessionSupervisor, SessionServer}
  alias Wapi.Authorization

  def connect(conn, %{"whatsapp_id" => whatsapp_id}) do
    user_id = conn.assigns.user_id

    unless Authorization.can_manage_whatsapp?(user_id, whatsapp_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Forbidden"}) |> halt()
    else
      case SessionSupervisor.start_session(whatsapp_id) do
        {:ok, _pid} ->
          SessionServer.connect(whatsapp_id)
          json(conn, %{status: "connecting", whatsapp_id: whatsapp_id})

        {:error, reason} ->
          conn |> put_status(500) |> json(%{error: inspect(reason)})
      end
    end
  end

  def disconnect(conn, %{"whatsapp_id" => whatsapp_id}) do
    user_id = conn.assigns.user_id

    unless Authorization.can_manage_whatsapp?(user_id, whatsapp_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Forbidden"}) |> halt()
    else
      case SessionServer.disconnect(whatsapp_id) do
        :ok ->
          json(conn, %{status: "disconnected", whatsapp_id: whatsapp_id})

        {:error, reason} ->
          conn |> put_status(500) |> json(%{error: inspect(reason)})
      end
    end
  end

  def reset(conn, %{"whatsapp_id" => whatsapp_id}) do
    user_id = conn.assigns.user_id

    unless Authorization.can_manage_whatsapp?(user_id, whatsapp_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Forbidden"}) |> halt()
    else
      case SessionServer.force_reset(whatsapp_id) do
        :ok ->
          json(conn, %{status: "reset", whatsapp_id: whatsapp_id})

        {:error, reason} ->
          conn |> put_status(500) |> json(%{error: inspect(reason)})
      end
    end
  end

  def status(conn, %{"whatsapp_id" => whatsapp_id}) do
    user_id = conn.assigns.user_id

    unless Authorization.can_access_whatsapp?(user_id, whatsapp_id) do
      conn |> put_status(:forbidden) |> json(%{error: "Forbidden"}) |> halt()
    else
      status = SessionServer.get_status(whatsapp_id)
      json(conn, %{whatsapp_id: whatsapp_id, status: status})
    end
  end

  def list(conn, _params) do
    user_id = conn.assigns.user_id

    sessions =
      SessionSupervisor.list_sessions()
      |> Enum.filter(fn {id, _pid} ->
        Authorization.can_access_whatsapp?(user_id, id)
      end)
      |> Enum.map(fn {id, _pid} ->
        %{whatsapp_id: id, status: SessionServer.get_status(id)}
      end)

    json(conn, %{sessions: sessions})
  end
end
