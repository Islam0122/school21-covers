import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, Copy, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditor } from '@/stores/editor'
import type { Block, Registry } from '@/types'
import { BlockView, SiteFrame, type RenderContext } from './renderer'

const DEVICE_WIDTH = { desktop: '100%', tablet: '768px', mobile: '390px' }

function CanvasBlock({ block, index, total, label, ctx, readOnly }: { block: Block; index: number; total: number; label: string; ctx: RenderContext; readOnly: boolean }) {
  const { selectedId, select, move, duplicate, remove, device } = useEditor()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: readOnly })
  const selected = selectedId === block.id
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])
  const hiddenHere = block.hidden || block.hiddenOn.includes(device)
  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        ref.current = el
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('group/block relative', isDragging && 'z-20 opacity-80')}
      onClick={(e) => {
        e.stopPropagation()
        select(block.id)
      }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 z-10 transition-shadow',
          selected ? 'shadow-[inset_0_0_0_2px_#2563eb]' : 'group-hover/block:shadow-[inset_0_0_0_1px_#06b6d4]',
        )}
      />
      <div
        className={cn(
          'absolute left-2 top-2 z-20 flex items-center gap-0.5 rounded-lg bg-[#2563eb] p-0.5 text-white shadow-lg',
          selected ? 'flex' : 'hidden group-hover/block:flex',
        )}
      >
        {!readOnly && (
          <button type="button" className="cursor-grab rounded p-1 hover:bg-white/20 active:cursor-grabbing" aria-label={`Drag ${label}`} {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
            <GripVertical className="size-3.5" />
          </button>
        )}
        <span className="px-1.5 text-[11px] font-semibold">{label}</span>
        {!readOnly && (
          <>
            <ToolbarButton label="Move up" disabled={index === 0} onClick={() => move(block.id, -1)} icon={ArrowUp} />
            <ToolbarButton label="Move down" disabled={index === total - 1} onClick={() => move(block.id, 1)} icon={ArrowDown} />
            <ToolbarButton label="Duplicate" onClick={() => duplicate(block.id)} icon={Copy} />
            <ToolbarButton label="Delete" onClick={() => remove(block.id)} icon={Trash2} />
          </>
        )}
      </div>
      {hiddenHere && (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-medium text-white">
          <EyeOff className="size-3" /> {block.hidden ? 'Hidden' : `Hidden on ${device}`}
        </div>
      )}
      <div className={cn(hiddenHere && 'opacity-35')}>
        <BlockView block={block} ctx={ctx} />
      </div>
    </div>
  )
}

function ToolbarButton({ label, onClick, icon: Icon, disabled }: { label: string; onClick: () => void; icon: React.ComponentType<{ className?: string }>; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="rounded p-1 hover:bg-white/20 disabled:opacity-40 cursor-pointer"
    >
      <Icon className="size-3.5" />
    </button>
  )
}

export function Canvas({ registry, readOnly, onAddClick }: { registry: Registry; readOnly: boolean; onAddClick: () => void }) {
  const { blocks, theme, device, select, reorderTo } = useEditor()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const labels = Object.fromEntries(registry.components.map((c) => [c.type, c.label]))
  if (!theme) return null
  const ctx: RenderContext = { theme, editing: true }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    reorderTo(blocks.findIndex((b) => b.id === active.id), blocks.findIndex((b) => b.id === over.id))
  }
  return (
    <div className="flex-1 overflow-auto bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(148,163,184,0.04)_10px,rgba(148,163,184,0.04)_20px)] p-4 sm:p-8 scrollbar-thin" onClick={() => select(null)}>
      <div className="mx-auto overflow-hidden rounded-xl border border-line shadow-2xl transition-[max-width] duration-300" style={{ maxWidth: DEVICE_WIDTH[device] }} aria-label={`Canvas (${device})`}>
        <SiteFrame theme={theme} className="min-h-[70vh]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map((b, i) => (
                <CanvasBlock key={b.id} block={b} index={i} total={blocks.length} label={labels[b.type] ?? b.type} ctx={ctx} readOnly={readOnly} />
              ))}
            </SortableContext>
          </DndContext>
          {blocks.length === 0 && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center" style={{ color: theme.mutedText }}>
              <p className="text-lg font-semibold" style={{ color: theme.text }}>
                This page is empty
              </p>
              <p className="text-sm">Add components from the left panel to start designing.</p>
              {!readOnly && (
                <button type="button" onClick={(e) => (e.stopPropagation(), onAddClick())} className="mt-2 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white cursor-pointer" style={{ background: theme.primary }}>
                  <Plus className="size-4" /> Add component
                </button>
              )}
            </div>
          )}
        </SiteFrame>
      </div>
    </div>
  )
}
