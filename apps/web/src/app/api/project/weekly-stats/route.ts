import { NextResponse } from 'next/server'
import { getAllProjectsWeeklyStats } from '@/lib/project/weekly-stats'

export async function GET() {
  try {
    const stats = await getAllProjectsWeeklyStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Failed to fetch all-projects weekly stats:', err)
    return NextResponse.json({ error: 'Failed to fetch weekly stats' }, { status: 500 })
  }
}
