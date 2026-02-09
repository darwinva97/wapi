defmodule Wapi.Schema.ChatConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "chat_config" do
    field :chat_id, :string
    field :custom_name, :string
    field :cleanup_excluded, :boolean, default: false
    field :cleanup_included, :boolean, default: false

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:id, :whatsapp_id, :chat_id, :custom_name, :cleanup_excluded, :cleanup_included])
    |> validate_required([:id, :whatsapp_id, :chat_id])
    |> foreign_key_constraint(:whatsapp_id)
  end
end
