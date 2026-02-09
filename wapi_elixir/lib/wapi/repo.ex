defmodule Wapi.Repo do
  use Ecto.Repo,
    otp_app: :wapi,
    adapter: Ecto.Adapters.Postgres
end
