import FormulaInput from '@/components/dashboard/FormulaInput'

export default function MetricWeighting() {
  return (
    <div className="relative flex flex-col gap-y-10 pb-24">
      {/* header */}
      <div className="w-full h-full bg-[#C3DDF9] px-16 pt-12 pb-[5.5rem]">
        <h1 className="text-6xl font-extrabold text-wdcc-oshan">Weighting</h1>
        <p className="mt-8 text-lg tracking-wide text-wdcc-grey font-mono">
          Two formulas drive the whole dashboard - Project Health Score and the Weekly MVP.
        </p>
      </div>
      <FormulaInput type="Health" />
      <FormulaInput type="MVP" />
    </div>
  )
}
