import { DATABASE_URL, DATABASE_AUTH_TOKEN } from '@/config';
import { drizzle } from 'drizzle-orm/libsql';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from "./schema";

// Lazy initialization to avoid connection during build time
let _db: LibSQLDatabase<typeof schema> | null = null;

export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle({
        connection: {
          url: DATABASE_URL,
          authToken: DATABASE_AUTH_TOKEN,
        },
        schema
      });
    }
    return Reflect.get(_db, prop);
  }
});
