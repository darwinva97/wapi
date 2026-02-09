defmodule Wapi.Repo.Migrations.CreateConfigTables do
  use Ecto.Migration

  def up do
    create_if_not_exists table(:platform_config, primary_key: false) do
      add :id, :text, primary_key: true, default: "default"
      add :allow_registration, :boolean, null: false, default: false
      add :allow_user_create_whatsapp, :boolean, null: false, default: true
      add :default_max_whatsapp_instances, :integer, null: false, default: 0
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists table(:user_config, primary_key: false) do
      add :id, :text, primary_key: true
      add :user_id, references(:user, type: :text, on_delete: :delete_all), null: false
      add :can_create_whatsapp, :boolean
      add :max_whatsapp_instances, :integer
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists unique_index(:user_config, [:user_id])

    create_if_not_exists table(:whatsapp_member, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :user_id, references(:user, type: :text, on_delete: :delete_all), null: false
      add :role, :text, null: false, default: "agent"
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :created_by, references(:user, type: :text, on_delete: :nilify_all)
    end

    create_if_not_exists index(:whatsapp_member, [:whatsapp_id])
    create_if_not_exists index(:whatsapp_member, [:user_id])
    create_if_not_exists index(:whatsapp_member, [:whatsapp_id, :user_id])

    create_if_not_exists table(:whatsapp_cleanup_config, primary_key: false) do
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), primary_key: true
      add :cleanup_enabled, :boolean, null: false, default: false
      add :cleanup_days, :integer, null: false, default: 30
      add :exclude_chats, :jsonb, default: "[]"
      add :include_only_chats, :jsonb, default: "[]"
      add :force_cleanup, :boolean, null: false, default: false
      add :max_agent_retention_days, :integer, null: false, default: 90
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists table(:chat_config, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :custom_name, :text
      add :cleanup_excluded, :boolean, null: false, default: false
      add :cleanup_included, :boolean, null: false, default: false
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists index(:chat_config, [:whatsapp_id])
    create_if_not_exists index(:chat_config, [:whatsapp_id, :chat_id])

    create_if_not_exists table(:chat_note, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :chat_id, :text, null: false
      add :content, :text, null: false
      add :created_by, references(:user, type: :text, on_delete: :delete_all), null: false
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists index(:chat_note, [:whatsapp_id])
    create_if_not_exists index(:chat_note, [:whatsapp_id, :chat_id])

    create_if_not_exists table(:storage_config, primary_key: false) do
      add :id, :text, primary_key: true, default: "default"
      add :storage_type, :text, null: false, default: "local"
      add :s3_endpoint, :text
      add :s3_bucket, :text
      add :s3_region, :text
      add :s3_access_key, :text
      add :s3_secret_key, :text
      add :s3_public_url, :text
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end
  end

  def down do
    drop_if_exists table(:storage_config)
    drop_if_exists table(:chat_note)
    drop_if_exists table(:chat_config)
    drop_if_exists table(:whatsapp_cleanup_config)
    drop_if_exists table(:whatsapp_member)
    drop_if_exists table(:user_config)
    drop_if_exists table(:platform_config)
  end
end
