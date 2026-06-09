import { hasRole } from '@/lib/auth'
// import { db } from "@repo/db"

export async function PUT(/* request: Request */) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    return Response.json({ status: 200 })
  } catch (error) {
    console.error('Error fetching people:', error)
    return Response.json({ error: 'Failed' }, { status: 500 })
  }
}
