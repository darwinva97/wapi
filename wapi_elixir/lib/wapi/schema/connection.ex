defmodule Wapi.Schema.Connection do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, autogenerate: false}
  schema "connection" do
    field :name, :string
    field :description, :string
    field :slug, :string
    field :receiver_enabled, :boolean, default: false
    field :receiver_request, :map
    field :receiver_filter, :map
    field :sender_enabled, :boolean, default: false
    field :sender_token, :string

    belongs_to :whatsapp, Wapi.Schema.Whatsapp, type: :string
  end

  def changeset(connection, attrs) do
    connection
    |> cast(attrs, [
      :id, :whatsapp_id, :name, :description, :slug,
      :receiver_enabled, :receiver_request, :receiver_filter,
      :sender_enabled, :sender_token
    ])
    |> validate_required([:id, :whatsapp_id, :name, :slug])
    |> unique_constraint(:slug)
    |> validate_format(:slug, ~r/^[a-z0-9\-]+$/)
    |> foreign_key_constraint(:whatsapp_id)
    |> validate_receiver_request()
  end

  defp validate_receiver_request(changeset) do
    validate_change(changeset, :receiver_request, fn :receiver_request, value ->
      case value do
        %{"url" => url} when is_binary(url) and url != "" ->
          if String.starts_with?(url, "http") do
            []
          else
            [receiver_request: "url must start with http:// or https://"]
          end

        nil ->
          []

        _ ->
          [receiver_request: "must contain a valid 'url' field"]
      end
    end)
  end
end
