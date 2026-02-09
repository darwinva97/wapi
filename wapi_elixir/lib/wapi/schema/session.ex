defmodule Wapi.Schema.Session do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "session" do
    field :expires_at, :utc_datetime_usec
    field :token, :string
    field :ip_address, :string
    field :user_agent, :string

    belongs_to :user, Wapi.Schema.User, type: :string

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)
  end

  def changeset(session, attrs) do
    session
    |> cast(attrs, [:id, :expires_at, :token, :ip_address, :user_agent, :user_id])
    |> validate_required([:id, :expires_at, :token, :user_id])
    |> unique_constraint(:token)
    |> foreign_key_constraint(:user_id)
  end
end
