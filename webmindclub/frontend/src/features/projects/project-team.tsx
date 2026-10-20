import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Select } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/states'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { roleLabel } from '@/lib/labels'
import { projectApi, workspaceApi } from '@/services/api'
import type { Project, ProjectMember } from '@/types'

export function ProjectTeam({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('editor')
  const [removing, setRemoving] = useState<ProjectMember | null>(null)
  const members = useQuery({ queryKey: qk.projectMembers(project.id), queryFn: () => projectApi.members(project.id) })
  const wsMembers = useQuery({ queryKey: qk.members(project.workspace), queryFn: () => workspaceApi.members(project.workspace), enabled: project.permissions.manage })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.projectMembers(project.id) })
    void qc.invalidateQueries({ queryKey: qk.project(project.id) })
    void qc.invalidateQueries({ queryKey: qk.members(project.workspace) })
  }
  const add = useMutation({
    mutationFn: ({ uid, r }: { uid: number; r: string }) => projectApi.addMember(project.id, uid, r),
    onSuccess: () => (refresh(), setUserId(''), toast.success('Member updated')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => projectApi.removeMember(project.id, id),
    onSuccess: () => (refresh(), toast.success('Member removed from project')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const assigned = new Set(members.data?.map((m) => m.user.id))
  const candidates = wsMembers.data?.filter((m) => !assigned.has(m.user.id)) ?? []
  const wsRole = (uid: number) => wsMembers.data?.find((m) => m.user.id === uid)?.role
  return (
    <Card>
      <CardHeader>
        <CardTitle>Project team</CardTitle>
        <span className="text-sm text-muted">{members.data?.length ?? 0} members</span>
      </CardHeader>
      <CardContent>
        {project.permissions.manage && (
          <form
            className="mb-5 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              if (userId) add.mutate({ uid: Number(userId), r: role })
            }}
          >
            <Select aria-label="Workspace member" value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1">
              <option value="">Add a workspace member…</option>
              {candidates.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.display_name} ({roleLabel(m.role)})
                </option>
              ))}
            </Select>
            <Select aria-label="Project role" value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-36">
              <option value="lead">Lead</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button type="submit" disabled={!userId} loading={add.isPending}>
              <UserPlus /> Add
            </Button>
          </form>
        )}
        {members.isLoading ? (
          <LoadingState className="py-6" />
        ) : (
          <ul className="divide-y divide-line">
            {members.data?.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.user.display_name} src={m.user.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.display_name} {m.user.id === project.owner.id && <Badge tone="purple">Owner</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {m.user.email}
                    {wsRole(m.user.id) && ` · ${roleLabel(wsRole(m.user.id))}`}
                  </p>
                </div>
                {project.permissions.manage && m.user.id !== project.owner.id ? (
                  <>
                    <Select aria-label={`Project role for ${m.user.display_name}`} value={m.role} onChange={(e) => add.mutate({ uid: m.user.id, r: e.target.value })} className="h-8 w-28 text-xs">
                      <option value="lead">Lead</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Viewer</option>
                    </Select>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.user.display_name}`} onClick={() => setRemoving(m)}>
                      <X />
                    </Button>
                  </>
                ) : (
                  <Badge className="capitalize">{m.role}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">Project roles: Lead can manage the project; Editor can change pages and tasks; Viewer is read-only. Workspace viewers are always read-only.</p>
      </CardContent>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.user.display_name} from this project?`}
        description="They keep their workspace membership but lose access to this project (unless it is shared with the whole workspace)."
        confirmLabel="Remove"
        onConfirm={() => removing && remove.mutateAsync(removing.id).catch(() => undefined)}
      />
    </Card>
  )
}
