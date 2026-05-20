export const BORDER_DEFAULT =
  'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4)) border-box'
export const BORDER_HOVER =
  'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(255,176,95,1), rgba(227,51,163,1), rgba(7,124,241,1)) border-box'

export const inputClass =
  'font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light'
export const labelClass =
  'font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold'

export const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  GITHUB: { bg: 'bg-wdcc-oshan/10', text: 'text-wdcc-oshan' },
  DISCORD: { bg: 'bg-wdcc-kelvin/10', text: 'text-wdcc-kelvin' },
}
