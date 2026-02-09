defmodule WapiWeb do
  @moduledoc """
  The entrypoint for defining your web interface.
  """

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]
      import Plug.Conn

      unquote(verified_routes())
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: WapiWeb.Endpoint,
        router: WapiWeb.Router
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
