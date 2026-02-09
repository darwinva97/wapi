defmodule Wapi.Schema.ChatNote do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "chat_note" do
    field :chat_id, :string
    field :content, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
    belongs_to :created_by_user, Wapi.Schema.User, foreign_key: :created_by, type: :string

    timestamps(inserted_at: :created_at, updated_at: :updated_at, type: :utc_datetime_usec)
  end

  def changeset(note, attrs) do
    note
    |> cast(attrs, [:id, :whatsapp_id, :chat_id, :content, :created_by])
    |> validate_required([:id, :whatsapp_id, :chat_id, :content, :created_by])
    |> foreign_key_constraint(:whatsapp_id)
    |> foreign_key_constraint(:created_by)
  end
end
