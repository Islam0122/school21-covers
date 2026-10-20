import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/forms'
import { authApi } from '@/services/api'
import { AuthShell } from './auth-shell'

const schema = z
  .object({ new_password: z.string().min(8, 'Use at least 8 characters.'), confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const uid = params.get('uid') ?? ''
  const token = params.get('token') ?? ''
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { new_password: '', confirm: '' } })
  const onSubmit = form.handleSubmit(async ({ new_password }) => {
    try {
      await authApi.confirmReset({ uid, token, new_password })
      toast.success('Password updated. You can sign in now.')
      navigate('/signin', { replace: true })
    } catch (e) {
      applyServerErrors(e, form.setError, ['new_password'])
    }
  })
  if (!uid || !token)
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is incomplete. Request a new one.">
        <Button asChild className="w-full">
          <Link to="/forgot-password">Request new link</Link>
        </Button>
      </AuthShell>
    )
  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="new_password" error={form.formState.errors.new_password?.message}>
          <Input id="new_password" type="password" autoComplete="new-password" {...form.register('new_password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={form.formState.errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" {...form.register('confirm')} />
        </Field>
        <Button type="submit" variant="gradient" className="w-full" loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
