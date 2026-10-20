import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditor } from '@/stores/editor'
import type { Block, Registry } from '@/types'

function LayerRow({ block, label, readOnly }: { block: Block; label: string; readOnly: boolean }) {
  const { selectedId, select, patch } = useEditor()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: readOnly })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-sm',
        selectedId === block.id ? 'border-brand-blue bg-brand-blue/10' : 'border-transparent hover:bg-hover',
        isDragging && 'z-10 shadow-lg bg-elevated',
      )}
    >
      {!readOnly && (
        <button type="button" className="cursor-grab rounded p-1 text-muted hover:text-fg active:cursor-grabbing" aria-label={`Reorder ${label}`} {...attributes} {...listeners}>
          <GripVertical className="size-3.5" />
        </button>
      )}
      <button type="button" className={cn('flex-1 truncate text-left cursor-pointer', block.hidden && 'opacity-50')} onClick={() => select(block.id)}>
        {label}
        {block.hiddenOn.length > 0 && <span className="ml-1 text-[10px] text-muted">(hidden on {block.hiddenOn.join(', ')})</span>}
      </button>
      {!readOnly && (
        <button type="button" className="rounded p-1 text-muted hover:text-fg cursor-pointer" aria-label={block.hidden ? `Show ${label}` : `Hide ${label}`} onClick={() => patch(block.id, { hidden: !block.hidden })}>
          {block.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      )}
    </li>
  )
}

export function LayersPanel({ registry, readOnly }: { registry: Registry; readOnly: boolean }) {
  const { blocks, reorderTo } = useEditor()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const labels = Object.fromEntries(registry.components.map((c) => [c.type, c.label]))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    reorderTo(blocks.findIndex((b) => b.id === active.id), blocks.findIndex((b) => b.id === over.id))
  }
  if (!blocks.length)
    return (
      <div className="flex flex-col items-center p-8 text-center text-sm text-muted">
        <Layers className="mb-2 size-5" /> This page has no components yet.
      </div>
    )
  return (
    <div className="p-3">
      <p className="mb-2 px-1 text-xs text-muted">Drag to reorder. Keyboard: focus a handle, press Space, then arrow keys.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-0.5">
            {blocks.map((b) => (
              <LayerRow key={b.id} block={b} label={labels[b.type] ?? b.type} readOnly={readOnly} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
