defmodule WapiWeb.Presence do
  use Phoenix.Presence,
    otp_app: :wapi,
    pubsub_server: Wapi.PubSub
end
