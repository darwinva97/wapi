defmodule Wapi.Storage do
  @moduledoc """
  Storage abstraction for saving and deleting media files.
  Supports local filesystem and S3-compatible storage.
  """
  require Logger

  alias Wapi.Repo
  alias Wapi.Schema.StorageConfig

  def get_config do
    case Repo.get(StorageConfig, "default") do
      nil -> %{storage_type: "local"}
      config -> config
    end
  rescue
    _ -> %{storage_type: "local"}
  end

  @doc "Save a file to storage (local or S3). Returns {:ok, url} or {:error, reason}."
  def save_file(buffer, filename, mime_type, whatsapp_id) when is_binary(buffer) do
    config = get_config()

    case config.storage_type do
      "s3" -> save_to_s3(buffer, filename, mime_type, whatsapp_id, config)
      _ -> save_to_local(buffer, filename, mime_type, whatsapp_id)
    end
  end

  @doc "Delete a file from storage. Returns :ok or {:error, reason}."
  def delete_file(url) when is_binary(url) do
    config = get_config()

    case config.storage_type do
      "s3" -> delete_from_s3(url, config)
      _ -> delete_from_local(url)
    end
  end

  # --- Local Storage ---

  defp save_to_local(buffer, filename, mime_type, whatsapp_id) do
    ext = extension_from_mime(mime_type) || Path.extname(filename) || ""
    unique_name = "#{Ecto.UUID.generate()}#{ext}"
    today = Date.utc_today() |> Date.to_iso8601()
    relative_path = "media/#{whatsapp_id}/#{today}"
    absolute_path = Path.join([File.cwd!(), "priv", "static", relative_path])

    File.mkdir_p!(absolute_path)

    file_path = Path.join(absolute_path, unique_name)
    File.write!(file_path, buffer)

    url = "/#{relative_path}/#{unique_name}"
    {:ok, url}
  rescue
    e ->
      Logger.error("[Storage] Local save error: #{inspect(e)}")
      {:error, inspect(e)}
  end

  defp delete_from_local(url) do
    file_path = Path.join([File.cwd!(), "priv", "static", url])

    case File.rm(file_path) do
      :ok -> :ok
      {:error, :enoent} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # --- S3 Storage ---

  defp save_to_s3(buffer, filename, mime_type, whatsapp_id, config) do
    ext = extension_from_mime(mime_type) || Path.extname(filename) || ""
    today = Date.utc_today() |> Date.to_iso8601()
    key = "#{whatsapp_id}/#{today}/#{Ecto.UUID.generate()}#{ext}"

    client = build_s3_client(config)

    case ExAws.S3.put_object(config.s3_bucket, key, buffer, content_type: mime_type)
         |> ExAws.request(client) do
      {:ok, _} ->
        url =
          if config.s3_public_url do
            "#{String.trim_trailing(config.s3_public_url, "/")}/#{key}"
          else
            "#{config.s3_endpoint}/#{config.s3_bucket}/#{key}"
          end

        {:ok, url}

      {:error, reason} ->
        Logger.error("[Storage] S3 upload error: #{inspect(reason)}")
        {:error, inspect(reason)}
    end
  rescue
    e ->
      Logger.error("[Storage] S3 save error: #{inspect(e)}")
      {:error, inspect(e)}
  end

  defp delete_from_s3(file_path, config) do
    # TODO: Implement full AWS v4 signing or add {:ex_aws, "~> 2.5"} dependency
    # For now, log a warning
    Logger.warning(
      "S3 deletion not yet fully implemented. File: #{file_path}. Add :ex_aws dependency for production use."
    )

    bucket = config.s3_bucket
    key = extract_s3_key(file_path, config)
    url = build_s3_url(config, bucket, key)

    case Req.delete(url, headers: build_s3_headers(config)) do
      {:ok, %{status: status}} when status in [200, 204] -> :ok
      {:ok, resp} -> {:error, "S3 delete failed with status #{resp.status}"}
      {:error, reason} -> {:error, "S3 request failed: #{inspect(reason)}"}
    end
  rescue
    e ->
      Logger.error("S3 deletion failed for #{file_path}: #{inspect(e)}")
      {:error, inspect(e)}
  end

  defp build_s3_headers(config) do
    headers = [{"content-type", "application/octet-stream"}]

    if config.s3_access_key && config.s3_secret_key do
      auth = Base.encode64("#{config.s3_access_key}:#{config.s3_secret_key}")
      [{"authorization", "Basic #{auth}"} | headers]
    else
      headers
    end
  end

  defp build_s3_url(config, bucket, key) do
    endpoint =
      config.s3_endpoint || "https://s3.#{config.s3_region || "us-east-1"}.amazonaws.com"

    "#{endpoint}/#{bucket}/#{URI.encode(key)}"
  end

  defp extract_s3_key(url, config) do
    endpoint =
      config.s3_endpoint || "https://s3.#{config.s3_region || "us-east-1"}.amazonaws.com"

    bucket = config.s3_bucket

    url
    |> String.replace("#{endpoint}/#{bucket}/", "")
    |> URI.decode()
  end

  defp build_s3_client(config) do
    [
      access_key_id: config.s3_access_key,
      secret_access_key: config.s3_secret_key,
      region: config.s3_region || "us-east-1"
    ]
  end

  # --- Helpers ---

  defp extension_from_mime(mime) do
    %{
      "image/jpeg" => ".jpg",
      "image/png" => ".png",
      "image/gif" => ".gif",
      "image/webp" => ".webp",
      "video/mp4" => ".mp4",
      "audio/ogg" => ".ogg",
      "audio/mpeg" => ".mp3",
      "application/pdf" => ".pdf",
      "text/plain" => ".txt"
    }
    |> Map.get(mime)
  end
end
