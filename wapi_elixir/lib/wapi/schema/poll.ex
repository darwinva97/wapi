defmodule Wapi.Schema.Poll do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "poll" do
    field :chat_id, :string
    field :question, :string
    field :options, :map
    field :allow_multiple_answers, :boolean, default: false
    field :created_by, :string
    field :timestamp, :utc_datetime_usec

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :message, Wapi.Schema.Message, type: :string

    has_many :votes, Wapi.Schema.PollVote
  end

  def changeset(poll, attrs) do
    poll
    |> cast(attrs, [
      :id, :whatsapp_id, :message_id, :chat_id, :question,
      :options, :allow_multiple_answers, :created_by, :timestamp
    ])
    |> validate_required([:id, :whatsapp_id, :message_id, :chat_id, :question, :options, :created_by, :timestamp])
    |> foreign_key_constraint(:whatsapp_id)
    |> foreign_key_constraint(:message_id)
  end
end
