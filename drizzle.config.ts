import { defineConfig } from "drizzle-kit";
import "@dotenvx/dotenvx/config";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
