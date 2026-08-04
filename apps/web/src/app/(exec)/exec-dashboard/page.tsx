import ExecProjectGraphs from '@/components/charts/ExecProjectGraphs'

export default async function ExecDashboardPage() {
  return (
    <main className="p-8 flex flex-col gap-10">
      <h1 className="text-2xl font-bold">WDCC Projects Health Dashboard — Exec View</h1>
      <ExecProjectGraphs />
    </main>
  )
}
