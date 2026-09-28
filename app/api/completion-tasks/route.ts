import { authorized } from '@/lib/auth';
import { env } from '@/lib/runtime';

type TaskPayload = {
  candidateIds?: number[];
  candidateId?: number;
  assignee?: string;
  dueDate?: string;
  status?: 'pending' | 'active' | 'completed';
};

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Returns management counts and the most urgent assigned completion tasks. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const today = new Date().toISOString().slice(0, 10);
  const [summary, tasks] = await Promise.all([
    db()
      .prepare(
        `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status<>'completed' AND due_date<? THEN 1 ELSE 0 END) AS overdue
         FROM completion_tasks`,
      )
      .bind(today)
      .first<Record<string, number | string | null>>(),
    db()
      .prepare(
        `SELECT t.candidate_id,c.name,c.asin,t.assignee,t.status,t.due_date,t.updated_at
         FROM completion_tasks t JOIN candidates c ON c.id=t.candidate_id
         ORDER BY
           CASE WHEN t.status<>'completed' AND t.due_date<? THEN 0
                WHEN t.status='active' THEN 1
                WHEN t.status='pending' THEN 2 ELSE 3 END,
           t.due_date ASC,t.updated_at DESC
         LIMIT 20`,
      )
      .bind(today)
      .all<Record<string, string | number | null>>(),
  ]);
  return Response.json({
    summary: {
      total: Number(summary?.total ?? 0),
      pending: Number(summary?.pending ?? 0),
      active: Number(summary?.active ?? 0),
      completed: Number(summary?.completed ?? 0),
      overdue: Number(summary?.overdue ?? 0),
    },
    tasks: tasks.results.map((row) => ({
      candidateId: Number(row.candidate_id),
      name: String(row.name ?? ''),
      asin: String(row.asin ?? ''),
      assignee: String(row.assignee ?? ''),
      status: String(row.status ?? 'pending'),
      dueDate: String(row.due_date ?? ''),
      overdue: String(row.status) !== 'completed' && String(row.due_date) < today,
      updatedAt: String(row.updated_at ?? ''),
    })),
  });
}

/** Assigns up to 20 candidate completion tasks to one owner. */
export async function POST(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as TaskPayload;
  const candidateIds = [...new Set(body.candidateIds ?? [])];
  const assignee = body.assignee?.trim().slice(0, 60) ?? '';
  const dueDate = body.dueDate?.trim() ?? '';
  if (
    candidateIds.length < 1 ||
    candidateIds.length > 20 ||
    candidateIds.some((id) => !Number.isInteger(id) || id < 1)
  )
    return Response.json({ error: '每次可分派 1–20 个有效商品' }, { status: 400 });
  if (!assignee) return Response.json({ error: '请填写负责人' }, { status: 400 });
  if (!validDate(dueDate))
    return Response.json({ error: '请选择有效截止日期' }, { status: 400 });
  const now = new Date().toISOString();
  await db().batch(
    candidateIds.map((candidateId) =>
      db()
        .prepare(
          `INSERT INTO completion_tasks
           (candidate_id,assignee,status,due_date,note,created_at,updated_at)
           VALUES (?,?,'pending',?,'',?,?)
           ON CONFLICT(candidate_id) DO UPDATE SET
           assignee=excluded.assignee,due_date=excluded.due_date,
           status=CASE WHEN completion_tasks.status='completed' THEN 'pending' ELSE completion_tasks.status END,
           updated_at=excluded.updated_at`,
        )
        .bind(candidateId, assignee, dueDate, now, now),
    ),
  );
  return Response.json({ assigned: candidateIds.length });
}

/** Advances one completion task through its bounded workflow. */
export async function PATCH(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as TaskPayload;
  if (!Number.isInteger(body.candidateId) || Number(body.candidateId) < 1)
    return Response.json({ error: '无效产品编号' }, { status: 400 });
  if (!body.status || !['pending', 'active', 'completed'].includes(body.status))
    return Response.json({ error: '无效任务状态' }, { status: 400 });
  const result = await db()
    .prepare('UPDATE completion_tasks SET status=?,updated_at=? WHERE candidate_id=?')
    .bind(body.status, new Date().toISOString(), body.candidateId!)
    .run();
  if (!result.meta.changes)
    return Response.json({ error: '该商品尚未分派任务' }, { status: 404 });
  return Response.json({ updated: true });
}
