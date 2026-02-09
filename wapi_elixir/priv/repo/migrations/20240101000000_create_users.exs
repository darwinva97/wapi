defmodule Wapi.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def up do
    create_if_not_exists table(:user, primary_key: false) do
      add :id, :text, primary_key: true
      add :name, :text, null: false
      add :email, :text, null: false
      add :email_verified, :boolean, default: false, null: false
      add :image, :text
      add :role, :text
      add :banned, :boolean, default: false
      add :ban_reason, :text
      add :ban_expires, :utc_datetime_usec
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists unique_index(:user, [:email])

    create_if_not_exists table(:session, primary_key: false) do
      add :id, :text, primary_key: true
      add :expires_at, :utc_datetime_usec, null: false
      add :token, :text, null: false
      add :ip_address, :text
      add :user_agent, :text
      add :user_id, references(:user, type: :text, on_delete: :delete_all), null: false
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists unique_index(:session, [:token])
    create_if_not_exists index(:session, [:user_id])

    create_if_not_exists table(:account, primary_key: false) do
      add :id, :text, primary_key: true
      add :account_id, :text, null: false
      add :provider_id, :text, null: false
      add :user_id, references(:user, type: :text, on_delete: :delete_all), null: false
      add :access_token, :text
      add :refresh_token, :text
      add :id_token, :text
      add :access_token_expires_at, :utc_datetime_usec
      add :refresh_token_expires_at, :utc_datetime_usec
      add :scope, :text
      add :password, :text
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists index(:account, [:user_id])

    create_if_not_exists table(:verification, primary_key: false) do
      add :id, :text, primary_key: true
      add :identifier, :text, null: false
      add :value, :text, null: false
      add :expires_at, :utc_datetime_usec, null: false
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :updated_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
    end

    create_if_not_exists index(:verification, [:identifier])
  end

  def down do
    drop_if_exists table(:verification)
    drop_if_exists table(:account)
    drop_if_exists table(:session)
    drop_if_exists table(:user)
  end
end
