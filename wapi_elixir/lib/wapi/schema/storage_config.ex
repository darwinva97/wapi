defmodule Wapi.Schema.StorageConfig do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  @valid_storage_types ~w(local s3)

  schema "storage_config" do
    field :storage_type, :string, default: "local"
    field :s3_endpoint, :string
    field :s3_bucket, :string
    field :s3_region, :string
    field :s3_access_key, :string
    field :s3_secret_key, :string
    field :s3_public_url, :string
    field :updated_at, :utc_datetime_usec
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [
      :id, :storage_type, :s3_endpoint, :s3_bucket,
      :s3_region, :s3_access_key, :s3_secret_key, :s3_public_url
    ])
    |> validate_inclusion(:storage_type, @valid_storage_types)
    |> validate_s3_config()
  end

  defp validate_s3_config(changeset) do
    if get_change(changeset, :storage_type) == "s3" || get_field(changeset, :storage_type) == "s3" do
      changeset
      |> validate_required([:s3_endpoint, :s3_bucket, :s3_access_key, :s3_secret_key])
    else
      changeset
    end
  end
end
