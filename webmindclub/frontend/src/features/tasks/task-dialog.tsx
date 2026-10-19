import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { applyServerErrors } from '@/lib/forms'
import { TASK_PRIORITIES, TASK_STATUSES } from '@/lib/labels'
import { projectApi, taskApi, workspaceApi } from '@/services/api'
import type { Task, TaskStatus } from '@/types'

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(200),
  description: z.string().max(5000),
  project: z.coerce.number<string>().int().positive('Choose a project.'),
  status: z.enum(['todo', 'in_progress', 'review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assignee_id: z.string(),
  due_date: z.string(),
})
type Values = z.input<typeof schema>
type Output = z.output<typeof schema>

export function TaskDialog({ open, onOpenChange, task, projectId, defaultStatus = 'todo' }: { open: boolean; onOpenChange: (o: boolean) => void; task?: Task | null; projectId?: number; defaultStatus?: TaskStatus }) {
  const { workspace } = useCurrentWorkspace()
  const qc = useQueryClient()
  const projects = useQuery({
    queryKey: qk.projects({ workspace: workspace!.id, editable: true }),
    queryFn: () => projectApi.list({ workspace: workspace!.id, page_size: 200 }),
    enabled: open && !projectId,
  })
  const members = useQuery({ queryKey: qk.members(workspace!.id), queryFn: () => workspaceApi.members(workspace!.id), enabled: open })
  const form = useForm<Values, unknown, Output>({ resolver: zodResolver(schema) })
  useEffect(() => {
    if (!open) return
    form.reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      project: String(task?.project ?? projectId ?? ''),
      status: task?.status ?? defaultStatus,
      priority: task?.priority ?? 'medium',
      assignee_id: task?.assignee ? String(task.assignee.id) : '',
      due_date: task?.due_date ?? '',
    })
  }, [open, task, projectId, defaultStatus, form])
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async (v) => {
    const payload = { ...v, assignee_id: v.assignee_id ? Number(v.assignee_id) : null, due_date: v.due_date || null }
    try {
      if (task) await taskApi.update(task.id, payload)
      else await taskApi.create(payload)
      await qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['workspaces'] })
      void qc.invalidateQueries({ queryKey: ['project'] })
      toast.success(task ? 'Task updated' : 'Task created')
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(e, form.setError, ['title', 'description', 'project', 'status', 'priority', 'assignee_id', 'due_date'])
    }
  })
  const editableProjects = projects.data?.results.filter((p) => p.permissions.edit) ?? []
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={task ? 'Edit task' : 'New task'}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="t-title" error={errors.title?.message}>
            <Input id="t-title" autoFocus {...form.register('title')} />
          </Field>
          <Field label="Description" htmlFor="t-desc" error={errors.description?.message}>
            <Textarea id="t-desc" rows={3} {...form.register('description')} />
          </Field>
          {!projectId && !task && (
            <Field label="Project" htmlFor="t-project" error={errors.project?.message}>
              <Select id="t-project" {...form.register('project')}>
                <option value="">Select a project…</option>
                {editableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="t-status">
              <Select id="t-status" {...form.register('status')}>
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="t-priority">
              <Select id="t-priority" {...form.register('priority')}>
                {TASK_PRIORITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee" htmlFor="t-assignee" error={errors.assignee_id?.message}>
              <Select id="t-assignee" {...form.register('assignee_id')}>
                <option value="">Unassigned</option>
                {members.data?.map((m) => (
                  <option key={m.user.id} value={m.user.id}>
                    {m.user.display_name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Due date" htmlFor="t-due" error={errors.due_date?.message}>
              <Input id="t-due" type="date" {...form.register('due_date')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {task ? 'Save task' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
