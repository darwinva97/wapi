"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getPlatformConfig } from "@/lib/auth-utils";

export async function checkRegistrationAllowed(): Promise<boolean> {
  noStore();
  const config = await getPlatformConfig();
  return config.allowRegistration;
}
