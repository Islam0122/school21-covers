import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditor } from '@/stores/editor'
import type { Registry, ThemeTokens } from '@/types'
import { ColorInput, PropertyField } from '../property-fields'

const COLOR_KEYS: (keyof ThemeTokens)[] = ['primary', 'secondary', 'background', 'surface', 'text', 'mutedText']
const OTHER_KEYS: (keyof ThemeTokens)[] = ['headingFont', 'bodyFont', 'radius', 'buttonStyle', 'containerWidth']

export function ThemePanel({ registry, readOnly }: { registry: Registry; readOnly: boolean }) {
  const { theme, preset, setTheme } = useEditor()
  if (!theme) return null
  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Presets</p>
        <div className="grid grid-cols-2 gap-2">
          {registry.presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setTheme(p.tokens, p.key)}
              aria-pressed={preset === p.key}
              className={cn('rounded-xl border p-2 text-left transition-colors cursor-pointer', preset === p.key ? 'border-brand-blue ring-2 ring-brand-blue/30' : 'border-line hover:bg-hover')}
            >
              <div className="flex h-8 overflow-hidden rounded-md" style={{ background: p.tokens.background }}>
                <span className="w-1/3" style={{ background: p.tokens.primary }} />
                <span className="w-1/4" style={{ background: p.tokens.secondary }} />
                <span className="flex flex-1 items-center justify-center text-[10px] font-bold" style={{ color: p.tokens.text, fontFamily: p.tokens.headingFont }}>
                  Aa
                </span>
              </div>
              <span className="mt-1.5 flex items-center justify-between text-xs font-medium">
                {p.name} {preset === p.key && <Check className="size-3 text-brand-blue" />}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Colors</p>
        {COLOR_KEYS.map((k) => (
          <div key={k} className="space-y-1.5">
            <label htmlFor={`theme-${k}`} className="text-xs text-muted">
              {registry.theme[k].label}
            </label>
            <ColorInput id={`theme-${k}`} value={String(theme[k])} allowEmpty={false} onChange={(v) => setTheme({ [k]: v })} />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Typography & layout</p>
        {OTHER_KEYS.map((k) => (
          <PropertyField key={k} id={`theme-${k}`} spec={registry.theme[k]} value={theme[k]} onChange={(v) => setTheme({ [k]: v } as Partial<ThemeTokens>)} />
        ))}
      </div>
    </fieldset>
  )
}
