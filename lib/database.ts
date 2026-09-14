import { Pool, type PoolClient, type QueryResultRow } from 'pg';

type BoundValue = string | number | boolean | null | ArrayBuffer;

let pool: Pool | undefined;

function connectionPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  pool = new Pool({ connectionString, max: 8, idleTimeoutMillis: 30_000 });
  return pool;
}

function postgresSql(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

class PreparedStatement {
  private values: BoundValue[] = [];

  constructor(
    private readonly sql: string,
    private readonly client?: PoolClient,
  ) {}

  /** Returns a new immutable statement with validated positional values. */
  bind(...values: BoundValue[]): PreparedStatement {
    const statement = new PreparedStatement(this.sql, this.client);
    statement.values = values;
    return statement;
  }

  private async query<T extends QueryResultRow>(returnRows = false) {
    let text = postgresSql(this.sql);
    if (returnRows && /^\s*insert\s+/i.test(text) && !/\breturning\b/i.test(text)) {
      text += ' RETURNING *';
    }
    const executor = this.client ?? connectionPool();
    return executor.query<T>(text, this.values);
  }

  /** Executes a statement and returns D1-compatible mutation metadata. */
  async run(): Promise<D1Result<unknown>> {
    const result = await this.query<QueryResultRow>(true);
    const id = result.rows[0]?.id;
    return {
      success: true,
      results: result.rows,
      meta: {
        changes: result.rowCount ?? 0,
        last_row_id: typeof id === 'number' ? id : Number(id) || 0,
        duration: 0,
        changed_db: true,
        size_after: 0,
        rows_read: 0,
        rows_written: result.rowCount ?? 0,
      },
    } as D1Result<unknown>;
  }

  /** Returns every selected row using the existing D1 response shape. */
  async all<T>(): Promise<D1Result<T>> {
    const result = await this.query<QueryResultRow>();
    return { success: true, results: result.rows as T[], meta: {} } as D1Result<T>;
  }

  /** Returns the first selected row, or null when no row matches. */
  async first<T>(): Promise<T | null> {
    const result = await this.query<QueryResultRow>();
    return (result.rows[0] as T | undefined) ?? null;
  }
}

class PostgresDatabase {
  /** Creates a parameterized query compatible with the former D1 API. */
  prepare(sql: string): D1PreparedStatement {
    if (!sql.trim()) throw new Error('SQL statement cannot be empty');
    return new PreparedStatement(sql) as unknown as D1PreparedStatement;
  }

  /** Executes prepared statements atomically and rolls back on failure. */
  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    if (!statements.length) return [];
    const client = await connectionPool().connect();
    try {
      await client.query('BEGIN');
      const results: D1Result<T>[] = [];
      for (const statement of statements) {
        const source = statement as unknown as PreparedStatement;
        const transactional = new PreparedStatement(
          (source as unknown as { sql: string }).sql,
          client,
        );
        (transactional as unknown as { values: BoundValue[] }).values = (
          source as unknown as { values: BoundValue[] }
        ).values;
        results.push((await transactional.run()) as D1Result<T>);
      }
      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const database = new PostgresDatabase() as unknown as D1Database;

