defmodule Wapi.Schema.WhatsappCleanupConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:whatsapp_id, :string, autogenerate: false}
  schema "whatsapp_cleanup_config" do
    field :cleanup_enabled, :boolean, default: false
    field :cleanup_days, :integer, default: 30
    field :exclude_chats, {:array, :string}, default: []
    field :include_only_chats, {:array, :string}, default: []
    field :force_cleanup, :boolean, default: false
    field :max_agent_retention_days, :integer, default: 90
    field :updated_at, :utc_datetime_usec
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [
      :whatsapp_id, :cleanup_enabled, :cleanup_days, :exclude_chats,
      :include_only_chats, :force_cleanup, :max_agent_retention_days
    ])
    |> validate_required([:whatsapp_id])
    |> validate_number(:cleanup_days, greater_than: 0)
    |> validate_number(:max_agent_retention_days, greater_than: 0)
    |> foreign_key_constraint(:whatsapp_id)
  end
end
