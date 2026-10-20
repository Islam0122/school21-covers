import { Copy, Eye, EyeOff, MousePointerClick, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEditor } from '@/stores/editor'
import type { Asset, Device, Registry } from '@/types'
import { PropertyField } from '../property-fields'
import { ThemePanel } from './theme-panel'

const STYLE_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Typography', keys: ['fontScale', 'align'] },
  { title: 'Colors', keys: ['textColor'] },
  { title: 'Background', keys: ['background'] },
  { title: 'Spacing', keys: ['paddingTop', 'paddingBottom', 'width'] },
  { title: 'Borders', keys: ['borderWidth', 'borderColor', 'radius'] },
]

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-b border-line pb-4 last:border-0">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</legend>
      {children}
    </fieldset>
  )
}

export function PropertiesPanel({ registry, assets, readOnly }: { registry: Registry; assets: Asset[]; readOnly: boolean }) {
  const { blocks, selectedId, patch, remove, duplicate } = useEditor()
  const block = blocks.find((b) => b.id === selectedId)
  const spec = block && registry.components.find((c) => c.type === block.type)
  const [tab, setTab] = useState('content')

  return (
    <Tabs value={block ? tab : 'theme'} onValueChange={setTab} className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <TabsList className="w-full">
          <TabsTrigger value="content" className="flex-1" disabled={!block}>
            Component
          </TabsTrigger>
          <TabsTrigger value="style" className="flex-1" disabled={!block}>
            Design
          </TabsTrigger>
          <TabsTrigger value="theme" className="flex-1">
            Theme
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {!block && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            <MousePointerClick className="size-4 shrink-0" /> Select a component on the canvas to edit its properties.
          </div>
        )}
        {block && spec && (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted">{spec.category}</p>
                <p className="font-display font-semibold">{spec.label}</p>
              </div>
              {!readOnly && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Duplicate component" onClick={() => duplicate(block.id)}>
                    <Copy />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={block.hidden ? 'Show component' : 'Hide component'} onClick={() => patch(block.id, { hidden: !block.hidden })}>
                    {block.hidden ? <EyeOff /> : <Eye />}
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete component" className="hover:text-red-500" onClick={() => remove(block.id)}>
                    <Trash2 />
                  </Button>
                </div>
              )}
            </div>
            <fieldset disabled={readOnly} className="contents">
              <TabsContent value="content" className="space-y-4">
                {Object.entries(spec.props).map(([key, f]) => (
                  <PropertyField key={`${block.id}-${key}`} id={`prop-${key}`} spec={f} value={block.props[key]} assets={assets} onChange={(v) => patch(block.id, { props: { [key]: v } }, `${block.id}:p:${key}`)} />
                ))}
              </TabsContent>
              <TabsContent value="style" className="space-y-4">
                {STYLE_GROUPS.map((g) => (
                  <Group key={g.title} title={g.title}>
                    {g.keys.map((key) => (
                      <PropertyField
                        key={`${block.id}-${key}`}
                        id={`style-${key}`}
                        spec={registry.style[key]}
                        value={(block.style as unknown as Record<string, unknown>)[key]}
                        onChange={(v) => patch(block.id, { style: { [key]: v } }, `${block.id}:s:${key}`)}
                      />
                    ))}
                  </Group>
                ))}
                <Group title="Visibility">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="vis-hidden">Hidden everywhere</Label>
                    <Switch id="vis-hidden" checked={block.hidden} onCheckedChange={(v) => patch(block.id, { hidden: v })} />
                  </div>
                  {(registry.devices as Device[]).map((d) => (
                    <div key={d} className="flex items-center justify-between">
                      <Label htmlFor={`vis-${d}`} className="capitalize">
                        Hide on {d}
                      </Label>
                      <Switch
                        id={`vis-${d}`}
                        checked={block.hiddenOn.includes(d)}
                        onCheckedChange={(v) => patch(block.id, { hiddenOn: v ? [...block.hiddenOn, d] : block.hiddenOn.filter((x) => x !== d) })}
                      />
                    </div>
                  ))}
                </Group>
              </TabsContent>
            </fieldset>
          </>
        )}
        <TabsContent value="theme">
          <ThemePanel registry={registry} readOnly={readOnly} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
