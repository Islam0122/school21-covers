import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, KanbanSquare, List, ListTodo, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Input, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { useDebounce } from '@/hooks/use-debounce'
import { errorMessage } from '@/lib/forms'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/labels'
import { cn, formatDate } from '@/lib/utils'
import { taskApi, workspaceApi } from '@/services/api'
import type { Task, TaskStatus } from '@/types'
import { TaskDialog } from './task-dialog'

function isOverdue(t: Task) {
  return t.status !== 'done' && !!t.due_date && new Date(t.due_date) < new Date(new Date().toDateString())
}

function TaskMenu({ task, onEdit, onDelete, onMove }: { task: Task; onEdit: () => void; onDelete: () => void; onMove: (s: TaskStatus) => void }) {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${task.title}`} onPointerDown={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem onSelect={onEdit}>
          <Pencil /> Edit
        </DropdownItem>
        <DropdownSeparator />
        <DropdownLabel>Move to</DropdownLabel>
        {TASK_STATUSES.filter((s) => s.value !== task.status).map((s) => (
          <DropdownItem key={s.value} onSelect={() => onMove(s.value)}>
            {s.label}
          </DropdownItem>
        ))}
        <DropdownSeparator />
        <DropdownItem destructive onSelect={onDelete}>
          <Trash2 /> Delete
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  )
}

function TaskCard({ task, showProject, ...menu }: { task: Task; showProject: boolean; onEdit: () => void; onDelete: () => void; onMove: (s: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const prio = TASK_PRIORITIES.find((p) => p.value === task.priority)!
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn('cursor-grab rounded-xl border border-line bg-surface p-3 shadow-sm active:cursor-grabbing', isDragging && 'z-30 rotate-1 shadow-xl')}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <TaskMenu task={task} {...menu} />
      </div>
      {showProject && <p className="mt-1 text-xs text-muted">{task.project_name}</p>}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge tone={prio.tone}>{prio.label}</Badge>
          {task.due_date && (
            <span className={cn('flex items-center gap-1 text-xs', isOverdue(task) ? 'text-red-500' : 'text-muted')}>
              <CalendarClock className="size-3" /> {formatDate(task.due_date, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        {task.assignee && <Avatar name={task.assignee.display_name} src={task.assignee.avatar} className="size-6" />}
      </div>
    </div>
  )
}

function Column({ status, label, tone, children, count, onAdd }: { status: TaskStatus; label: string; tone: string; children: React.ReactNode; count: number; onAdd?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} aria-label={label} className={cn('flex min-h-64 flex-col rounded-card border border-line bg-bg/40 p-3 transition-colors', isOver && 'border-brand-blue bg-brand-blue/5')}>
      <header className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('size-2 rounded-full', { neutral: 'bg-slate-400', blue: 'bg-blue-500', amber: 'bg-amber-500', green: 'bg-emerald-500' }[tone])} />
          {label} <span className="text-xs font-normal text-muted">{count}</span>
        </span>
        {onAdd && (
          <Button variant="ghost" size="icon-sm" aria-label={`Add task to ${label}`} onClick={onAdd}>
            <Plus />
          </Button>
        )}
      </header>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </section>
  )
}

export function TaskBoard({ projectId, canEdit = true }: { projectId?: number; canEdit?: boolean }) {
  const { workspace } = useCurrentWorkspace()
  const qc = useQueryClient()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [search, setSearch] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dialog, setDialog] = useState<{ task?: Task; status?: TaskStatus } | null>(null)
  const [toDelete, setToDelete] = useState<Task | null>(null)
  const debounced = useDebounce(search)
  const query = { workspace: projectId ? undefined : workspace!.id, project: projectId, search: debounced, assignee: assignee ? Number(assignee) : undefined }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.tasks(query), queryFn: () => taskApi.list(query) })
  const members = useQuery({ queryKey: qk.members(workspace!.id), queryFn: () => workspaceApi.members(workspace!.id) })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor))

  const update = useMutation({
    mutationFn: ({ id, status }: { id: number; status: TaskStatus }) => taskApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.tasks(query) })
      const prev = qc.getQueryData<Task[]>(qk.tasks(query))
      qc.setQueryData<Task[]>(qk.tasks(query), (old) => old?.map((t) => (t.id === id ? { ...t, status } : t)))
      return { prev }
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(qk.tasks(query), ctx?.prev)
      toast.error(errorMessage(e))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
  const remove = useMutation({
    mutationFn: (id: number) => taskApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Task deleted')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return
    const task = data?.find((t) => t.id === active.id)
    if (task && task.status !== over.id) update.mutate({ id: task.id, status: over.id as TaskStatus })
  }
  const menu = (t: Task) => ({
    onEdit: () => setDialog({ task: t }),
    onDelete: () => setToDelete(t),
    onMove: (status: TaskStatus) => update.mutate({ id: t.id, status }),
  })

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks" className="pl-9" aria-label="Search tasks" />
        </div>
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Filter by assignee" className="sm:w-48">
          <option value="">All assignees</option>
          {members.data?.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.display_name}
            </option>
          ))}
        </Select>
        <div className="flex rounded-xl border border-line p-0.5">
          {(['board', 'list'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm cursor-pointer', view === v ? 'bg-elevated text-fg' : 'text-muted')}>
              {v === 'board' ? <KanbanSquare className="size-4" /> : <List className="size-4" />} {v === 'board' ? 'Kanban' : 'List'}
            </button>
          ))}
        </div>
        {canEdit && (
          <Button onClick={() => setDialog({})}>
            <Plus /> New task
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : data.length === 0 && !debounced && !assignee ? (
        <EmptyState icon={ListTodo} title="No tasks yet" description="Plan the work for your project with tasks." action={canEdit && <Button onClick={() => setDialog({})}><Plus /> New task</Button>} />
      ) : view === 'board' ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {TASK_STATUSES.map((s) => {
              const items = data.filter((t) => t.status === s.value)
              return (
                <Column key={s.value} status={s.value} label={s.label} tone={s.tone} count={items.length} onAdd={canEdit ? () => setDialog({ status: s.value }) : undefined}>
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} showProject={!projectId} {...menu(t)} />
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-xs text-muted">Drop tasks here</p>}
                </Column>
              )
            })}
          </div>
        </DndContext>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Task</th>
                {!projectId && <th className="px-4 py-3 font-medium">Project</th>}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Due</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {data.map((t) => {
                const prio = TASK_PRIORITIES.find((p) => p.value === t.priority)!
                return (
                  <tr key={t.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{t.title}</td>
                    {!projectId && <td className="px-4 py-3 text-muted">{t.project_name}</td>}
                    <td className="px-4 py-3">
                      <Select aria-label="Status" value={t.status} disabled={!canEdit} onChange={(e) => update.mutate({ id: t.id, status: e.target.value as TaskStatus })} className="h-8 w-36 text-xs">
                        {TASK_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={prio.tone}>{prio.label}</Badge>
                    </td>
                    <td className="px-4 py-3">{t.assignee ? <span className="flex items-center gap-2"><Avatar name={t.assignee.display_name} src={t.assignee.avatar} className="size-6" />{t.assignee.display_name}</span> : <span className="text-muted">Unassigned</span>}</td>
                    <td className={cn('px-4 py-3', isOverdue(t) ? 'text-red-500' : 'text-muted')}>{formatDate(t.due_date)}</td>
                    <td className="px-2">
                      <TaskMenu task={t} {...menu(t)} />
                    </td>
                  </tr>
                )
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted">
                    No tasks match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <TaskDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} task={dialog?.task} projectId={projectId} defaultStatus={dialog?.status} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete task?"
        description={`“${toDelete?.title}” will be permanently deleted.`}
        confirmLabel="Delete task"
        onConfirm={() => toDelete && remove.mutateAsync(toDelete.id).catch(() => undefined)}
      />
    </div>
  )
}
