import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/forms'
import { authApi } from '@/services/api'
import { ensureCsrf } from '@/services/http'
import { useAuth } from '@/stores/auth'
import { AuthShell } from './auth-shell'

const schema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
})
type Values = z.infer<typeof schema>

export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app'
}

export default function SignInPage() {
  const setUser = useAuth((s) => s.setUser)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const user = await authApi.login(values)
      await ensureCsrf(true) // Django rotates the CSRF token on login
      setUser(user)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (e) {
      applyServerErrors(e, form.setError, ['email', 'password'])
    }
  })

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your WebMindClub workspace."
      footer={
        <>
          New to WebMindClub?{' '}
          <Link to={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`} className="font-medium text-brand-blue hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-brand-blue hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" variant="gradient" className="w-full" loading={isSubmitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
