import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from "@/config";
import { platformConfigTable } from "@/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      session: schema.sessionTable,
      account: schema.accountTable,
      verification: schema.verificationTable,
    },
  }),
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  plugins: [
    admin({
      defaultRole: "user",
    }),
  ],
  emailAndPassword: {
    enabled: true,
    async signUpEnabled() {
      // Check platform config to see if registration is allowed
      try {
        const config = await db.query.platformConfigTable.findFirst();
        return config?.allowRegistration ?? false;
      } catch {
        // If table doesn't exist yet, default to disabled
        return false;
      }
    },
  },
});
