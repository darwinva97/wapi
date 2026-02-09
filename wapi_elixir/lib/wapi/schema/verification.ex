defmodule Wapi.Schema.Verification do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "verification" do
    field :identifier, :string
    field :value, :string
    field :expires_at, :utc_datetime_usec

    timestamps(type: :utc_datetime_usec, inserted_at: :created_at)
  end

  def changeset(verification, attrs) do
    verification
    |> cast(attrs, [:id, :identifier, :value, :expires_at])
    |> validate_required([:id, :identifier, :value, :expires_at])
  end
end
