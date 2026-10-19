import * as Popover from '@radix-ui/react-popover'
import { ChevronDown, ChevronUp, ImageIcon, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Input, Label, Select, Textarea } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { Asset, FieldSpec } from '@/types'
import { fieldError, reorder } from './block-ops'
import { ICONS } from './icons'

interface FieldProps {
  id: string
  spec: FieldSpec
  value: unknown
  onChange: (value: unknown) => void
  assets?: Asset[]
}

export function ColorInput({ id, value, onChange, allowEmpty = true }: { id: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const [draft, setDraft] = useState(value)
  const [prev, setPrev] = useState(value)
  if (prev !== value) {
    setPrev(value)
    setDraft(value)
  }
  return (
    <div className="flex gap-2">
      <input
        type="color"
        aria-label="Pick color"
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1"
      />
      <Input
        id={id}
        value={draft}
        placeholder={allowEmpty ? 'Inherit' : '#000000'}
        className="h-9"
        onChange={(e) => {
          setDraft(e.target.value)
          if (/^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))$/.test(e.target.value) || (allowEmpty && e.target.value === '')) onChange(e.target.value)
        }}
      />
      {allowEmpty && value && (
        <button type="button" aria-label="Clear color" onClick={() => onChange('')} className="rounded-lg px-2 text-muted hover:bg-hover hover:text-fg cursor-pointer">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

function ImageField({ id, value, onChange, assets = [] }: { id: string; value: string; onChange: (v: string) => void; assets?: Asset[] }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input id={id} value={value} placeholder="https://… or choose an asset" className="h-9" onChange={(e) => onChange(e.target.value)} />
        <Popover.Root>
          <Popover.Trigger asChild>
            <button type="button" className="rounded-lg border border-line px-2.5 text-muted hover:bg-hover hover:text-fg cursor-pointer" aria-label="Choose from assets">
              <ImageIcon className="size-4" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-xl border border-line bg-elevated p-3 shadow-xl">
              <p className="mb-2 text-xs font-medium text-muted">Project assets</p>
              {assets.length === 0 ? (
                <p className="text-sm text-muted">No assets yet. Upload images in the Assets panel.</p>
              ) : (
                <div className="grid max-h-60 grid-cols-3 gap-2 overflow-y-auto scrollbar-thin">
                  {assets.map((a) => (
                    <Popover.Close key={a.id} asChild>
                      <button type="button" onClick={() => onChange(a.url)} className="overflow-hidden rounded-lg border border-line hover:border-brand-blue cursor-pointer" title={a.original_name}>
                        <img src={a.url} alt={a.original_name} className="aspect-square w-full object-cover" />
                      </button>
                    </Popover.Close>
                  ))}
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {value && <img src={value} alt="" className="h-20 w-full rounded-lg border border-line object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
    </div>
  )
}

function ListField({ id, spec, value, onChange, assets }: FieldProps) {
  const items = (value as Record<string, unknown>[]) ?? []
  const [open, setOpen] = useState<number | null>(0)
  const fields = Object.entries(spec.fields ?? {})
  const titleKey = fields.find(([, f]) => f.type === 'text')?.[0]
  const blank = () => Object.fromEntries(fields.map(([k, f]) => [k, f.default ?? (f.type === 'boolean' ? false : '')]))
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-line">
          <div className="flex items-center gap-1 px-2 py-1.5">
            <button type="button" className="flex-1 truncate text-left text-sm font-medium cursor-pointer" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
              {(titleKey && String(item[titleKey] || '')) || `${spec.label} ${i + 1}`}
            </button>
            <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => onChange(reorder(items, i, i - 1))} className="rounded p-1 text-muted hover:bg-hover disabled:opacity-30 cursor-pointer">
              <ChevronUp className="size-3.5" />
            </button>
            <button type="button" aria-label="Move down" disabled={i === items.length - 1} onClick={() => onChange(reorder(items, i, i + 1))} className="rounded p-1 text-muted hover:bg-hover disabled:opacity-30 cursor-pointer">
              <ChevronDown className="size-3.5" />
            </button>
            <button type="button" aria-label="Remove item" onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:bg-hover hover:text-red-500 cursor-pointer">
              <Trash2 className="size-3.5" />
            </button>
          </div>
          {open === i && (
            <div className="space-y-3 border-t border-line p-3">
              {fields.map(([k, f]) => (
                <PropertyField
                  key={k}
                  id={`${id}-${i}-${k}`}
                  spec={f}
                  value={item[k]}
                  assets={assets}
                  onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)))}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={items.length >= (spec.max ?? 12)}
        onClick={() => {
          onChange([...items, blank()])
          setOpen(items.length)
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2 text-sm text-muted hover:bg-hover hover:text-fg disabled:opacity-40 cursor-pointer"
      >
        <Plus className="size-4" /> Add item
      </button>
    </div>
  )
}

export function PropertyField({ id, spec, value, onChange, assets }: FieldProps) {
  const error = fieldError(spec, value)
  let control: React.ReactNode
  switch (spec.type) {
    case 'text':
    case 'url':
      control = <Input id={id} className="h-9" value={String(value ?? '')} maxLength={spec.max} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} placeholder={spec.type === 'url' ? '/page, #anchor or https://' : undefined} />
      break
    case 'textarea':
      control = <Textarea id={id} rows={3} value={String(value ?? '')} maxLength={spec.max} onChange={(e) => onChange(e.target.value)} />
      break
    case 'image':
      control = <ImageField id={id} value={String(value ?? '')} onChange={onChange} assets={assets} />
      break
    case 'color':
      control = <ColorInput id={id} value={String(value ?? '')} onChange={onChange} />
      break
    case 'number':
      control = (
        <div className="flex items-center gap-2">
          <input type="range" aria-label={spec.label} min={spec.min} max={spec.max} value={Number(value)} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-brand-blue" />
          <Input id={id} type="number" min={spec.min} max={spec.max} value={Number(value)} className="h-9 w-20" onChange={(e) => onChange(e.target.value === '' ? spec.min : Number(e.target.value))} />
        </div>
      )
      break
    case 'select':
      control = (
        <Select id={id} className="h-9" value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {spec.options?.map((o) => (
            <option key={o} value={o}>
              {String(o)}
            </option>
          ))}
        </Select>
      )
      break
    case 'icon':
      control = (
        <div role="radiogroup" aria-label={spec.label} className="grid grid-cols-6 gap-1">
          {spec.options?.map((o) => {
            const Icon = ICONS[String(o)]
            return (
              <button key={o} type="button" role="radio" aria-checked={value === o} aria-label={String(o)} title={String(o)} onClick={() => onChange(o)} className={cn('flex aspect-square items-center justify-center rounded-lg border cursor-pointer', value === o ? 'border-brand-blue bg-brand-blue/10 text-brand-blue' : 'border-line text-muted hover:bg-hover')}>
                {Icon && <Icon className="size-4" />}
              </button>
            )
          })}
        </div>
      )
      break
    case 'boolean':
      return (
        <div className="flex items-center justify-between">
          <Label htmlFor={id}>{spec.label}</Label>
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      )
    case 'list':
      control = <ListField id={id} spec={spec} value={value} onChange={onChange} assets={assets} />
      break
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted">
        {spec.label}
      </Label>
      {control}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
