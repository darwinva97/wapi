defmodule Wapi.Schema.Contact do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "contact" do
    field :name, :string
    field :push_name, :string
    field :lid, :string, default: ""
    field :pn, :string, default: ""
    field :description, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
  end

  def changeset(contact, attrs) do
    contact
    |> cast(attrs, [:id, :whatsapp_id, :name, :push_name, :lid, :pn, :description])
    |> validate_required([:id, :whatsapp_id, :name, :push_name])
    |> foreign_key_constraint(:whatsapp_id)
  end

  @doc "Changeset for upserting contact data from Baileys events."
  def upsert_changeset(contact, attrs) do
    contact
    |> cast(attrs, [:name, :push_name, :lid, :pn])
    |> validate_lid_format()
    |> validate_pn_format()
  end

  defp validate_lid_format(changeset) do
    validate_change(changeset, :lid, fn :lid, value ->
      if value == "" || String.contains?(value, "@lid") do
        []
      else
        [lid: "must contain @lid or be empty"]
      end
    end)
  end

  defp validate_pn_format(changeset) do
    validate_change(changeset, :pn, fn :pn, value ->
      if value == "" || String.contains?(value, "@s.whatsapp.net") do
        []
      else
        [pn: "must contain @s.whatsapp.net or be empty"]
      end
    end)
  end
end
