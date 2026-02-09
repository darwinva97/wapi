defmodule Wapi.Schema.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "message" do
    field :chat_id, :string
    field :chat_type, :string
    field :sender_id, :string
    field :content, :map
    field :body, :string
    field :timestamp, :utc_datetime_usec
    field :from_me, :boolean, default: false
    field :message_type, :string, default: "text"
    field :media_url, :string
    field :media_metadata, :map
    field :ack_status, :integer, default: 0
    field :file_name, :string
    field :media_retention_until, :utc_datetime_usec
    field :sent_from_platform, :boolean, default: false

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string

    belongs_to :media_retention_set_by_user, Wapi.Schema.User,
      foreign_key: :media_retention_set_by,
      type: :string

    belongs_to :sent_by_user, Wapi.Schema.User,
      foreign_key: :sent_by_user_id,
      type: :string

    belongs_to :sent_by_connection, Wapi.Schema.Connection,
      foreign_key: :sent_by_connection_id,
      type: :string

    has_many :reactions, Wapi.Schema.Reaction
  end

  @valid_types ~w(text image video audio sticker document location)
  @valid_chat_types ~w(group personal)

  def changeset(message, attrs) do
    message
    |> cast(attrs, [
      :id, :whatsapp_id, :chat_id, :chat_type, :sender_id, :content, :body,
      :timestamp, :from_me, :message_type, :media_url, :media_metadata,
      :ack_status, :file_name, :media_retention_until, :media_retention_set_by,
      :sent_from_platform, :sent_by_user_id, :sent_by_connection_id
    ])
    |> validate_required([:id, :whatsapp_id, :chat_id, :chat_type, :sender_id, :timestamp])
    |> validate_inclusion(:message_type, @valid_types)
    |> validate_inclusion(:chat_type, @valid_chat_types)
    |> validate_inclusion(:ack_status, 0..3)
    |> foreign_key_constraint(:whatsapp_id)
  end

  def ack_changeset(message, ack_status) do
    message
    |> change(ack_status: ack_status)
    |> validate_inclusion(:ack_status, 0..3)
  end

  def media_changeset(message, attrs) do
    message
    |> cast(attrs, [:media_url, :media_metadata])
  end
end
