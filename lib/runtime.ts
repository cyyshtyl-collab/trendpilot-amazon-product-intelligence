import { database } from '@/lib/database';

/** Server-only runtime configuration used by API routes and authentication. */
export const env = new Proxy(
  { DB: database } as Record<string, unknown>,
  {
    get(target, property: string) {
      if (property === 'DB') return database;
      return process.env[property] ?? target[property];
    },
  },
);

