# Script for populating the database. You can run it as:
#
#     mix run priv/repo/seeds.exs
#
# This seeds file is safe to run multiple times thanks to upserts.

alias Wapi.Repo
alias Wapi.Schema.{PlatformConfig, StorageConfig}

# Ensure default platform config exists
case Repo.get(PlatformConfig, "default") do
  nil ->
    %PlatformConfig{}
    |> PlatformConfig.changeset(%{
      id: "default",
      allow_registration: false,
      allow_user_create_whatsapp: true,
      default_max_whatsapp_instances: 0
    })
    |> Repo.insert!()

    IO.puts("Created default platform config")

  _existing ->
    IO.puts("Default platform config already exists")
end

# Ensure default storage config exists
case Repo.get(StorageConfig, "default") do
  nil ->
    %StorageConfig{}
    |> StorageConfig.changeset(%{
      id: "default",
      storage_type: "local"
    })
    |> Repo.insert!()

    IO.puts("Created default storage config")

  _existing ->
    IO.puts("Default storage config already exists")
end
