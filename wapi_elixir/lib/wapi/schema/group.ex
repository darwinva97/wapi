defmodule Wapi.Schema.Group do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "group" do
    field :name, :string
    field :push_name, :string
    field :gid, :string
    field :description, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
  end

  def changeset(group, attrs) do
    group
    |> cast(attrs, [:id, :whatsapp_id, :name, :push_name, :gid, :description])
    |> validate_required([:id, :whatsapp_id, :name, :push_name, :gid])
    |> foreign_key_constraint(:whatsapp_id)
  end
end
