import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/forms'
import { PROJECT_STATUSES, PROJECT_TYPES } from '@/lib/labels'
import { projectApi } from '@/services/api'
import type { Project } from '@/types'

export const projectSchema = z.object({
  name: z.string().trim().min(2, 'Name must have at least 2 characters.').max(120),
  slug: z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.'),
  description: z.string().max(2000).optional(),
  project_type: z.enum(['website', 'saas', 'ecommerce', 'dashboard', 'landing', 'internal_tool']),
  status: z.enum(['draft', 'in_progress', 'review', 'published', 'archived']),
  visibility: z.enum(['private', 'workspace']),
})
type Values = z.infer<typeof projectSchema>

export function EditProjectDialog({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const form = useForm<Values>({ resolver: zodResolver(projectSchema) })
  useEffect(() => {
    if (open)
      form.reset({
        name: project.name,
        slug: project.slug,
        description: project.description,
        project_type: project.project_type,
        status: project.status,
        visibility: project.visibility,
      })
  }, [open, project, form])
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await projectApi.update(project.id, values)
      await Promise.all([qc.invalidateQueries({ queryKey: ['projects'] }), qc.invalidateQueries({ queryKey: ['project', project.id] })])
      toast.success('Project updated')
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(e, form.setError, Object.keys(projectSchema.shape))
    }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Edit project" description="Update the project details.">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="p-name" error={errors.name?.message}>
            <Input id="p-name" {...form.register('name')} />
          </Field>
          <Field label="Slug" htmlFor="p-slug" error={errors.slug?.message}>
            <Input id="p-slug" {...form.register('slug')} />
          </Field>
          <Field label="Description" htmlFor="p-desc" error={errors.description?.message}>
            <Textarea id="p-desc" rows={3} {...form.register('description')} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="p-type">
              <Select id="p-type" {...form.register('project_type')}>
                {PROJECT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="p-status">
              <Select id="p-status" {...form.register('status')}>
                {PROJECT_STATUSES.filter((s) => s.value !== 'archived').map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
                {project.status === 'archived' && <option value="archived">Archived</option>}
              </Select>
            </Field>
          </div>
          {project.permissions.manage && (
            <Field label="Visibility" htmlFor="p-vis" hint="Workspace visibility gives every member read access.">
              <Select id="p-vis" {...form.register('visibility')}>
                <option value="private">Private — assigned members only</option>
                <option value="workspace">Workspace — all members can view</option>
              </Select>
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
