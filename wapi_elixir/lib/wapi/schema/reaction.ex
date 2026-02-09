defmodule Wapi.Schema.Reaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "reaction" do
    field :chat_id, :string
    field :sender_id, :string
    field :emoji, :string
    field :timestamp, :utc_datetime_usec
    field :from_me, :boolean

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :message, Wapi.Schema.Message, type: :string
  end

  def changeset(reaction, attrs) do
    reaction
    |> cast(attrs, [:id, :whatsapp_id, :message_id, :chat_id, :sender_id, :emoji, :timestamp, :from_me])
    |> validate_required([:id, :whatsapp_id, :message_id, :chat_id, :sender_id, :emoji, :timestamp, :from_me])
    |> foreign_key_constraint(:whatsapp_id)
    |> foreign_key_constraint(:message_id)
  end
end
