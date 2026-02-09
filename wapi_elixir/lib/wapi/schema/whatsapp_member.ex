defmodule Wapi.Schema.WhatsappMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @valid_roles ~w(owner manager agent)

  schema "whatsapp_member" do
    field :role, :string, default: "agent"

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :user, Wapi.Schema.User, type: :string

    belongs_to :created_by_user, Wapi.Schema.User,
      foreign_key: :created_by,
      type: :string

    field :created_at, :utc_datetime_usec
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:id, :whatsapp_id, :user_id, :role, :created_by])
    |> validate_required([:id, :whatsapp_id, :user_id, :role])
    |> validate_inclusion(:role, @valid_roles)
    |> foreign_key_constraint(:whatsapp_id)
    |> foreign_key_constraint(:user_id)
    |> maybe_set_created_at()
  end

  defp maybe_set_created_at(changeset) do
    if get_field(changeset, :created_at) do
      changeset
    else
      put_change(changeset, :created_at, DateTime.utc_now())
    end
  end
end
