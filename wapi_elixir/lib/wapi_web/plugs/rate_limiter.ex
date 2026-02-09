defmodule WapiWeb.Plugs.RateLimiter do
  @moduledoc """
  Rate limiting plug using PlugAttack.
  - 60 requests/min per Bearer token
  - 120 requests/min per IP
  """
  use PlugAttack
  import Plug.Conn

  rule "throttle by token", conn do
    case get_bearer_token(conn) do
      nil ->
        :pass

      token ->
        throttle(token,
          period: 60_000,
          limit: 60,
          storage: {PlugAttack.Storage.Ets, Wapi.RateLimitStore}
        )
    end
  end

  rule "throttle by ip", conn do
    ip =
      conn.remote_ip
      |> :inet.ntoa()
      |> to_string()

    throttle(ip,
      period: 60_000,
      limit: 120,
      storage: {PlugAttack.Storage.Ets, Wapi.RateLimitStore}
    )
  end

  def allow_action(conn, {:throttle, data}, _opts) do
    conn
    |> put_resp_header("x-ratelimit-limit", to_string(data.limit))
    |> put_resp_header("x-ratelimit-remaining", to_string(data.remaining))
    |> put_resp_header("x-ratelimit-reset", to_string(data.expires_at))
  end

  def allow_action(conn, _data, _opts), do: conn

  def block_action(conn, {:throttle, data}, _opts) do
    retry_after = max(div(data.expires_at - System.system_time(:millisecond), 1000), 1)

    conn
    |> put_resp_header("retry-after", to_string(retry_after))
    |> put_resp_content_type("application/json")
    |> send_resp(429, Jason.encode!(%{error: "Rate limit exceeded", retry_after: retry_after}))
    |> halt()
  end

  def block_action(conn, _data, _opts) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(429, Jason.encode!(%{error: "Rate limit exceeded"}))
    |> halt()
  end

  defp get_bearer_token(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> token
      _ -> nil
    end
  end

end
