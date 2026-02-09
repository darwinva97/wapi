defmodule Wapi.Schema.PollVote do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "poll_vote" do
    field :voter_id, :string
    field :selected_options, :map
    field :timestamp, :utc_datetime_usec

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :poll, Wapi.Schema.Poll, type: :string
  end

  def changeset(vote, attrs) do
    vote
    |> cast(attrs, [:id, :whatsapp_id, :poll_id, :voter_id, :selected_options, :timestamp])
    |> validate_required([:id, :whatsapp_id, :poll_id, :voter_id, :selected_options, :timestamp])
    |> foreign_key_constraint(:whatsapp_id)
    |> foreign_key_constraint(:poll_id)
  end
end
