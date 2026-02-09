defmodule Wapi.Repo.Migrations.CreateWhatsapp do
  use Ecto.Migration

  def up do
    create_if_not_exists table(:whatsapp, primary_key: false) do
      add :id, :text, primary_key: true
      add :user_id, references(:user, type: :text, on_delete: :delete_all), null: false
      add :name, :text, null: false
      add :description, :text
      add :slug, :text, null: false
      add :phone_number, :text, null: false
      add :connected, :boolean, null: false, default: false
      add :enabled, :boolean, null: false, default: true
    end

    create_if_not_exists unique_index(:whatsapp, [:slug])
    create_if_not_exists unique_index(:whatsapp, [:phone_number])

    create_if_not_exists table(:contact, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :name, :text, null: false
      add :push_name, :text, null: false
      add :lid, :text, null: false, default: ""
      add :pn, :text, null: false, default: ""
      add :description, :text
    end

    create_if_not_exists table(:group, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :name, :text, null: false
      add :push_name, :text, null: false
      add :gid, :text, null: false
      add :description, :text
    end

    create_if_not_exists table(:connection, primary_key: false) do
      add :id, :text, primary_key: true
      add :whatsapp_id, references(:whatsapp, type: :text, on_delete: :delete_all), null: false
      add :name, :text, null: false
      add :description, :text
      add :slug, :text, null: false
      add :receiver_enabled, :boolean, null: false, default: false
      add :receiver_request, :jsonb
      add :receiver_filter, :jsonb
      add :sender_enabled, :boolean, null: false, default: false
      add :sender_token, :text
    end

    create_if_not_exists unique_index(:connection, [:slug])

    create_if_not_exists index(:contact, [:whatsapp_id])
    create_if_not_exists index(:group, [:whatsapp_id])
    create_if_not_exists index(:connection, [:whatsapp_id])
  end

  def down do
    drop_if_exists table(:connection)
    drop_if_exists table(:group)
    drop_if_exists table(:contact)
    drop_if_exists table(:whatsapp)
  end
end
