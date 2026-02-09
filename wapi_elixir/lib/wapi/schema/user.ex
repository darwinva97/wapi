defmodule Wapi.Schema.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "user" do
    field :name, :string
    field :email, :string
    field :email_verified, :boolean, default: false
    field :image, :string
    field :role, :string
    field :banned, :boolean, default: false
    field :ban_reason, :string
    field :ban_expires, :utc_datetime_usec

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)

    has_many :sessions, Wapi.Schema.Session
    has_many :accounts, Wapi.Schema.Account
    has_many :whatsapps, Wapi.Schema.Whatsapp
  end

  def changeset(user, attrs) do
    user
    |> cast(attrs, [:id, :name, :email, :email_verified, :image, :role, :banned, :ban_reason, :ban_expires])
    |> validate_required([:id, :name, :email])
    |> unique_constraint(:email)
    |> validate_format(:email, ~r/@/)
  end
end
