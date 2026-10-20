import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { PasswordForm } from '@/features/team/password-form'
import { ProfileForm } from '@/features/team/profile-form'
import { useCurrentWorkspace } from '@/hooks/use-workspace'
import { roleLabel } from '@/lib/labels'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/stores/auth'

export default function ProfilePage() {
  const user = useAuth((s) => s.user)
  const { workspaces } = useCurrentWorkspace()
  return (
    <div className="animate-fade-in">
      <PageHeader title="Profile" description={`Member since ${formatDate(user?.date_joined)}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {workspaces.map((w) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span className="truncate font-medium">{w.name}</span>
                  <span className="text-muted">{roleLabel(w.role)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
