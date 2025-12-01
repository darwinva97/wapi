import { defineConfig } from "drizzle-kit";
import "@dotenvx/dotenvx/config";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
