defmodule Wapi.Schema.Whatsapp do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "whatsapp" do
    field :name, :string
    field :description, :string
    field :slug, :string
    field :phone_number, :string
    field :connected, :boolean, default: false
    field :enabled, :boolean, default: true

    belongs_to :user, Wapi.Schema.User, type: :string

    has_many :contacts, Wapi.Schema.Contact
    has_many :groups, Wapi.Schema.Group
    has_many :connections, Wapi.Schema.Connection
    has_many :messages, Wapi.Schema.Message
    has_many :members, Wapi.Schema.WhatsappMember
    has_one :cleanup_config, Wapi.Schema.WhatsappCleanupConfig
  end

  def changeset(whatsapp, attrs) do
    whatsapp
    |> cast(attrs, [:id, :user_id, :name, :description, :slug, :phone_number, :connected, :enabled])
    |> validate_required([:id, :user_id, :name, :slug, :phone_number])
    |> unique_constraint(:slug)
    |> unique_constraint(:phone_number)
    |> foreign_key_constraint(:user_id)
    |> validate_format(:slug, ~r/^[a-z0-9\-]+$/, message: "only lowercase letters, numbers and hyphens")
  end

  def connection_changeset(whatsapp, attrs) do
    whatsapp
    |> cast(attrs, [:connected])
    |> validate_required([:connected])
  end
end
