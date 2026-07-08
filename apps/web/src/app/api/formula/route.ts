import { NextResponse } from 'next/server'
import { db } from '@repo/db'
import { z } from 'zod'
import { formulaSchema } from '@/lib/schemas/admin'

const FORMULA_KEY = 'healthFormula'
const GLOBAL_SCOPE = 'GLOBAL'

export async function GET() {
  const config = await db.config.findUnique({
    where: { scope_key: { scope: GLOBAL_SCOPE, key: FORMULA_KEY } },
  })

  return NextResponse.json({
    formula: config ? (config.value as string) : null,
  })
}

export async function PUT(request: Request) {
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
      scope_key: { scope: GLOBAL_SCOPE, key: FORMULA_KEY },
    },
    update: {
      value: validated.data,
    },
    create: {
      scope: GLOBAL_SCOPE,
      projectId: null,
      key: FORMULA_KEY,
      value: validated.data,
    },
  })

  return NextResponse.json({ formula: config.value as string })
}
