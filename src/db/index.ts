import { DATABASE_URL } from '@/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from "./schema";

// Lazy initialization to avoid connection during build time
let _db: NodePgDatabase<typeof schema> | null = null;

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle({
        connection: DATABASE_URL,
        schema
      });
    }
    return Reflect.get(_db, prop);
  }
});
