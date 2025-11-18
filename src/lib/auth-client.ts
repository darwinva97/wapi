import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { BETTER_AUTH_URL } from "@/config";

export const authClient = createAuthClient({
  baseURL: BETTER_AUTH_URL,
  plugins: [
    adminClient(),
  ],
});

export const {
  signIn,
  signOut,
  signUp,
  useSession,
} = authClient;
