defmodule Wapi.Authorization do
  @moduledoc """
  Authorization logic for checking user access to WhatsApp instances.
  Checks ownership and membership roles.
  """
  import Ecto.Query
  alias Wapi.Repo
  alias Wapi.Schema.{Whatsapp, WhatsappMember}

  @doc "Check if user can access (view) a WhatsApp instance."
  def can_access_whatsapp?(user_id, whatsapp_id) do
    is_owner?(user_id, whatsapp_id) || is_member?(user_id, whatsapp_id)
  end

  @doc "Check if user can manage (admin operations) a WhatsApp instance."
  def can_manage_whatsapp?(user_id, whatsapp_id) do
    is_owner?(user_id, whatsapp_id) || has_role?(user_id, whatsapp_id, ["owner", "manager"])
  end

  defp is_owner?(user_id, whatsapp_id) do
    Repo.exists?(
      from(w in Whatsapp,
        where: w.id == ^whatsapp_id and w.user_id == ^user_id
      )
    )
  end

  defp is_member?(user_id, whatsapp_id) do
    Repo.exists?(
      from(m in WhatsappMember,
        where: m.whatsapp_id == ^whatsapp_id and m.user_id == ^user_id
      )
    )
  end

  defp has_role?(user_id, whatsapp_id, roles) do
    Repo.exists?(
      from(m in WhatsappMember,
        where:
          m.whatsapp_id == ^whatsapp_id and
            m.user_id == ^user_id and
            m.role in ^roles
      )
    )
  end
end
