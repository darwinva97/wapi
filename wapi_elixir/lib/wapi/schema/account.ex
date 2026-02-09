defmodule Wapi.Schema.Account do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "account" do
    field :account_id, :string
    field :provider_id, :string
    field :access_token, :string
    field :refresh_token, :string
    field :id_token, :string
    field :access_token_expires_at, :utc_datetime_usec
    field :refresh_token_expires_at, :utc_datetime_usec
    field :scope, :string
    field :password, :string

    belongs_to :user, Wapi.Schema.User, type: :string

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)
  end

  def changeset(account, attrs) do
    account
    |> cast(attrs, [
      :id, :account_id, :provider_id, :user_id, :access_token,
      :refresh_token, :id_token, :access_token_expires_at,
      :refresh_token_expires_at, :scope, :password
    ])
    |> validate_required([:id, :account_id, :provider_id, :user_id])
    |> foreign_key_constraint(:user_id)
  end
end
