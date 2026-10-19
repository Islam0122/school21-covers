import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Copy, ExternalLink, MoreHorizontal, Pencil, Trash2, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { errorMessage } from '@/lib/forms'
import { projectApi } from '@/services/api'
import type { Project } from '@/types'
import { EditProjectDialog } from './edit-project-dialog'

export function useProjectMutations() {
  const qc = useQueryClient()
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['projects'] })
    void qc.invalidateQueries({ queryKey: ['project'] })
    void qc.invalidateQueries({ queryKey: ['workspaces'] })
  }
  const onError = (e: unknown) => toast.error(errorMessage(e))
  return {
    duplicate: useMutation({ mutationFn: projectApi.duplicate, onSuccess: (p) => (refresh(), toast.success(`Created ${p.name}`)), onError }),
    archive: useMutation({ mutationFn: projectApi.archive, onSuccess: () => (refresh(), toast.success('Project archived')), onError }),
    restore: useMutation({ mutationFn: projectApi.restore, onSuccess: () => (refresh(), toast.success('Project restored')), onError }),
    remove: useMutation({ mutationFn: projectApi.remove, onSuccess: () => (refresh(), toast.success('Project deleted')), onError }),
  }
}

export function ProjectActions({ project, onDeleted }: { project: Project; onDeleted?: () => void }) {
  const navigate = useNavigate()
  const m = useProjectMutations()
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const archived = project.status === 'archived'
  return (
    <>
      <Dropdown>
        <DropdownTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${project.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownTrigger>
        <DropdownContent>
          <DropdownItem onSelect={() => navigate(`/app/projects/${project.id}`)}>
            <ExternalLink /> Open
          </DropdownItem>
          {project.permissions.edit && (
            <>
              <DropdownItem onSelect={() => navigate(`/app/builder/${project.id}`)}>
                <Wand2 /> Open in builder
              </DropdownItem>
              <DropdownItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit details
              </DropdownItem>
            </>
          )}
          <DropdownItem onSelect={() => m.duplicate.mutate(project.id)}>
            <Copy /> Duplicate
          </DropdownItem>
          {project.permissions.manage && (
            <>
              <DropdownSeparator />
              {archived ? (
                <DropdownItem onSelect={() => m.restore.mutate(project.id)}>
                  <ArchiveRestore /> Restore
                </DropdownItem>
              ) : (
                <DropdownItem onSelect={() => setConfirm('archive')}>
                  <Archive /> Archive
                </DropdownItem>
              )}
              <DropdownItem destructive onSelect={() => setConfirm('delete')}>
                <Trash2 /> Delete
              </DropdownItem>
            </>
          )}
        </DropdownContent>
      </Dropdown>
      <EditProjectDialog project={project} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archive ${project.name}?`}
        description="Archived projects are hidden from lists but keep all pages, tasks and history. You can restore them later."
        confirmLabel="Archive"
        destructive={false}
        loading={m.archive.isPending}
        onConfirm={() => m.archive.mutateAsync(project.id).catch(() => undefined)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${project.name}?`}
        description="This permanently deletes the project with all pages, versions, tasks and published sites. This cannot be undone."
        confirmLabel="Delete project"
        loading={m.remove.isPending}
        onConfirm={() =>
          m.remove
            .mutateAsync(project.id)
            .then(() => onDeleted?.())
            .catch(() => undefined)
        }
      />
    </>
  )
}
