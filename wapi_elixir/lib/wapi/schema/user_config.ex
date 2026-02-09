defmodule Wapi.Schema.UserConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "user_config" do
    field :can_create_whatsapp, :boolean
    field :max_whatsapp_instances, :integer

    belongs_to :user, Wapi.Schema.User, type: :string

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:id, :user_id, :can_create_whatsapp, :max_whatsapp_instances])
    |> validate_required([:id, :user_id])
    |> unique_constraint(:user_id)
    |> foreign_key_constraint(:user_id)
  end
end
