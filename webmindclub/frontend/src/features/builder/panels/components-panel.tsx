import { LayoutGrid, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useEditor } from '@/stores/editor'
import type { Registry } from '@/types'
import { createBlock } from '../block-ops'

const SECTION_PRESETS: { name: string; description: string; types: string[] }[] = [
  { name: 'Hero with stats', description: 'Hero followed by key numbers', types: ['hero', 'stats'] },
  { name: 'Feature showcase', description: 'Heading, intro paragraph and feature cards', types: ['heading', 'paragraph', 'features'] },
  { name: 'Pricing & FAQ', description: 'Plans followed by common questions', types: ['pricing', 'faq'] },
  { name: 'Social proof', description: 'Testimonials with statistics', types: ['testimonials', 'stats'] },
  { name: 'Product catalogue', description: 'Product grid with call to action', types: ['products', 'button'] },
  { name: 'Contact & footer', description: 'Contact block and site footer', types: ['contact', 'footer'] },
]

export function ComponentsPanel({ registry, readOnly }: { registry: Registry; readOnly: boolean }) {
  const add = useEditor((s) => s.add)
  const categories = [...new Set(registry.components.map((c) => c.category))]
  if (readOnly) return <p className="p-4 text-sm text-muted">You have read-only access to this project.</p>
  return (
    <div className="space-y-5 p-4">
      <p className="text-xs text-muted">Click a component to insert it after the selected one (or at the end of the page).</p>
      {categories.map((cat) => (
        <div key={cat}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{cat}</p>
          <div className="grid grid-cols-2 gap-2">
            {registry.components
              .filter((c) => c.category === cat)
              .map((c) => (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => {
                    add(createBlock(registry, c.type))
                    toast.success(`${c.label} added`)
                  }}
                  className="group flex items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-left text-sm font-medium transition-colors hover:border-brand-blue/60 hover:bg-hover cursor-pointer"
                >
                  <Plus className="size-3.5 text-muted group-hover:text-brand-blue" />
                  {c.label}
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function SectionsPanel({ registry, readOnly }: { registry: Registry; readOnly: boolean }) {
  const addMany = useEditor((s) => s.addMany)
  if (readOnly) return <p className="p-4 text-sm text-muted">You have read-only access to this project.</p>
  return (
    <div className="space-y-2 p-4">
      <p className="mb-3 text-xs text-muted">Ready-made combinations of components.</p>
      {SECTION_PRESETS.map((s) => (
        <button
          key={s.name}
          type="button"
          onClick={() => {
            addMany(s.types.map((t) => createBlock(registry, t)))
            toast.success(`${s.name} added`)
          }}
          className="flex w-full items-start gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-brand-blue/60 hover:bg-hover cursor-pointer"
        >
          <span className="rounded-lg bg-brand-blue/10 p-2 text-brand-blue">
            <LayoutGrid className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-medium">{s.name}</span>
            <span className="text-xs text-muted">{s.description}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
