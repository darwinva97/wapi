import { DATABASE_URL, DATABASE_AUTH_TOKEN } from '@/config';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from "./schema"; 

export const db = drizzle({
  connection: {
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  },
  schema
});
