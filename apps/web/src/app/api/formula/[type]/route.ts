import { NextResponse } from 'next/server'
import { db, Role } from '@repo/db'
import { z } from 'zod'
import { formulaSchema } from '@/lib/schemas/admin'
import { hasRole } from '@/lib/auth'
import { recomputeAllHealthScores } from '@/lib/admin/health-score'
import { recomputeAllVelocity } from '@/lib/admin/velocity'

const VALID_TYPES = ['health', 'mvp'] as const
type FormulaType = (typeof VALID_TYPES)[number]

const formulaKey = (type: string) => `${type}Formula`
const GLOBAL_SCOPE = 'GLOBAL'

export async function GET(_: Request, { params }: { params: Promise<{ type: string }> }) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  const { type } = await params

  if (!VALID_TYPES.includes(type as FormulaType)) {
    return NextResponse.json({ message: 'Invalid formula type' }, { status: 400 })
  }

  const config = await db.config.findUnique({
    where: { scope_key: { scope: GLOBAL_SCOPE, key: formulaKey(type) } },
  })

  return NextResponse.json({
    formula: typeof config?.value === 'string' ? config.value : null,
    updatedAt: config?.updatedAt ?? null,
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ type: string }> }) {
  if (!(await hasRole(Role.ADMIN))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  const { type } = await params

  if (!VALID_TYPES.includes(type as FormulaType)) {
    return NextResponse.json({ message: 'Invalid formula type' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = z.object({ formula: z.string() }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Missing formula field' }, { status: 400 })
  }

  const validated = formulaSchema.safeParse(parsed.data.formula)
  if (!validated.success) {
    return NextResponse.json({ message: validated.error.issues[0].message }, { status: 422 })
  }

  const config = await db.config.upsert({
    where: {
      scope_key: { scope: GLOBAL_SCOPE, key: formulaKey(type) },
    },
    update: {
      value: validated.data,
    },
    create: {
      scope: GLOBAL_SCOPE,
      projectId: null,
      key: formulaKey(type),
      value: validated.data,
    },
  })

  if (type === 'health') {
    await recomputeAllHealthScores(validated.data)
    // Health scores just changed for every week, so velocity (which is derived from
    // them) must be recalculated too.
    await recomputeAllVelocity()
  }

  return NextResponse.json({ formula: config.value as string, updatedAt: config.updatedAt })
}
