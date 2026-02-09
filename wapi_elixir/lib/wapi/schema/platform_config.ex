defmodule Wapi.Schema.PlatformConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "platform_config" do
    field :allow_registration, :boolean, default: false
    field :allow_user_create_whatsapp, :boolean, default: true
    field :default_max_whatsapp_instances, :integer, default: 0
    field :updated_at, :utc_datetime_usec
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:allow_registration, :allow_user_create_whatsapp, :default_max_whatsapp_instances])
    |> validate_number(:default_max_whatsapp_instances, greater_than_or_equal_to: 0)
  end
end
