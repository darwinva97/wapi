defmodule Wapi.Release do
  @moduledoc """
  Functions for running in release context (migrations, seeds).

  Usage:
    bin/wapi eval "Wapi.Release.migrate()"
    bin/wapi eval "Wapi.Release.rollback(Wapi.Repo, 20240101000000)"
  """

  @app :wapi

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.load(@app)
  end
end
