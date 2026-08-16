import { NextResponse } from 'next/server'
import { db, Role } from '@repo/db'
import { z } from 'zod'
import { healthScoreThresholdSchema } from '@/lib/schemas/admin'
import { hasRole } from '@/lib/auth'
import {
  DEFAULT_HEALTH_SCORE_AVG4W_THRESHOLD,
  DEFAULT_HEALTH_SCORE_WEEK_THRESHOLD,
  HEALTH_SCORE_AVG4W_THRESHOLD_KEY,
  HEALTH_SCORE_WEEK_THRESHOLD_KEY,
} from '@/lib/admin/threshold'

const GLOBAL_SCOPE = 'GLOBAL'

export async function GET() {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  const configs = await db.config.findMany({
    where: {
      scope: GLOBAL_SCOPE,
      key: { in: [HEALTH_SCORE_WEEK_THRESHOLD_KEY, HEALTH_SCORE_AVG4W_THRESHOLD_KEY] },
    },
  })

  const week = configs.find((c) => c.key === HEALTH_SCORE_WEEK_THRESHOLD_KEY)?.value
  const avg4w = configs.find((c) => c.key === HEALTH_SCORE_AVG4W_THRESHOLD_KEY)?.value

  return NextResponse.json({
    week: typeof week === 'number' ? week : DEFAULT_HEALTH_SCORE_WEEK_THRESHOLD,
    avg4w: typeof avg4w === 'number' ? avg4w : DEFAULT_HEALTH_SCORE_AVG4W_THRESHOLD,
  })
}

export async function PUT(request: Request) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = z
    .object({ week: healthScoreThresholdSchema, avg4w: healthScoreThresholdSchema })
    .safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0].message }, { status: 422 })
  }

  const { week, avg4w } = parsed.data

  await db.$transaction([
    db.config.upsert({
      where: { scope_key: { scope: GLOBAL_SCOPE, key: HEALTH_SCORE_WEEK_THRESHOLD_KEY } },
      update: { value: week },
      create: {
        scope: GLOBAL_SCOPE,
        projectId: null,
        key: HEALTH_SCORE_WEEK_THRESHOLD_KEY,
        value: week,
      },
    }),
    db.config.upsert({
      where: { scope_key: { scope: GLOBAL_SCOPE, key: HEALTH_SCORE_AVG4W_THRESHOLD_KEY } },
      update: { value: avg4w },
      create: {
        scope: GLOBAL_SCOPE,
        projectId: null,
        key: HEALTH_SCORE_AVG4W_THRESHOLD_KEY,
        value: avg4w,
      },
    }),
  ])

  return NextResponse.json({ week, avg4w })
}
