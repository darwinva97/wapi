defmodule Wapi.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def up do
    create_if_not_exists table(:message, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :chat_type, :text, null: false
      add :sender_id, :text, null: false
      add :content, :jsonb
      add :body, :text
      add :timestamp, :utc_datetime_usec, null: false
      add :from_me, :boolean, null: false, default: false
      add :message_type, :text, null: false, default: "text"
      add :media_url, :text
      add :media_metadata, :jsonb
      add :ack_status, :integer, null: false, default: 0
      add :file_name, :text
      add :media_retention_until, :utc_datetime_usec
      add :media_retention_set_by, references(:user, type: :text, on_delete: :nilify_all)
      add :sent_from_platform, :boolean, default: false
      add :sent_by_user_id, references(:user, type: :text, on_delete: :nilify_all)
      add :sent_by_connection_id, references(:connection, type: :text, on_delete: :nilify_all)
    end

    create_if_not_exists index(:message, [:whatsapp_id])
    create_if_not_exists index(:message, [:chat_id])
    create_if_not_exists index(:message, [:whatsapp_id, :chat_id])
    create_if_not_exists index(:message, [:timestamp])

    create_if_not_exists table(:reaction, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :message_id, references(:message, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :sender_id, :text, null: false
      add :emoji, :text, null: false
      add :timestamp, :utc_datetime_usec, null: false
      add :from_me, :boolean, null: false
    end

    create_if_not_exists index(:reaction, [:message_id])
    create_if_not_exists index(:reaction, [:whatsapp_id])

    create_if_not_exists table(:poll, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :message_id, references(:message, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :question, :text, null: false
      add :options, :jsonb, null: false
      add :allow_multiple_answers, :boolean, null: false, default: false
      add :created_by, :text, null: false
      add :timestamp, :utc_datetime_usec, null: false
    end

    create_if_not_exists table(:poll_vote, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :poll_id, references(:poll, type: :text, on_delete: :delete_all), null: false
      add :voter_id, :text, null: false
      add :selected_options, :jsonb, null: false
      add :timestamp, :utc_datetime_usec, null: false
    end
  end

  def down do
    drop_if_exists table(:poll_vote)
    drop_if_exists table(:poll)
    drop_if_exists table(:reaction)
    drop_if_exists table(:message)
  end
end
