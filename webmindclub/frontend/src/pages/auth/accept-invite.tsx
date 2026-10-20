import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { errorMessage } from '@/lib/forms'
import { workspaceApi } from '@/services/api'
import { useAuth } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { AuthShell } from './auth-shell'

export default function AcceptInvitePage() {
  const { token = '' } = useParams()
  const user = useAuth((s) => s.user)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setCurrent = useWorkspaceStore((s) => s.setCurrent)
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => workspaceApi.previewInvitation(token) })
  const accept = useMutation({
    mutationFn: () => workspaceApi.acceptInvitation(token),
    onSuccess: (ws) => {
      setCurrent(ws.id)
      void qc.invalidateQueries()
      toast.success(`You joined ${ws.name}`)
      navigate('/app')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const next = encodeURIComponent(`/invite/${token}`)
  return (
    <AuthShell title="Workspace invitation">
      {invite.isLoading && <LoadingState />}
      {invite.error && <ErrorState error={invite.error} />}
      {invite.data && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            <strong className="text-fg">{invite.data.email}</strong> was invited to join{' '}
            <strong className="text-fg">{invite.data.workspace}</strong> as <strong className="text-fg">{invite.data.role}</strong>.
          </p>
          {user ? (
            user.email.toLowerCase() === invite.data.email.toLowerCase() ? (
              <Button variant="gradient" className="w-full" loading={accept.isPending} onClick={() => accept.mutate()}>
                Accept invitation
              </Button>
            ) : (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
                You are signed in as {user.email}. Sign in with {invite.data.email} to accept this invitation.
              </p>
            )
          ) : (
            <div className="grid gap-2">
              <Button asChild variant="gradient">
                <Link to={`/signup?next=${next}`}>Create account to accept</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/signin?next=${next}`}>I already have an account</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  )
}
