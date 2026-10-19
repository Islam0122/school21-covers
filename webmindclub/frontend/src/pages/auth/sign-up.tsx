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
import { safeNext } from './sign-in'

const schema = z
  .object({
    full_name: z.string().trim().min(2, 'Enter your full name.').max(150),
    email: z.email('Enter a valid email address.'),
    workspace_name: z.string().max(120).optional(),
    password: z.string().min(8, 'Use at least 8 characters.').max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })
type Values = z.infer<typeof schema>

export default function SignUpPage() {
  const setUser = useAuth((s) => s.setUser)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: '', email: '', workspace_name: '', password: '', confirm: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ confirm: _confirm, ...values }) => {
    try {
      const user = await authApi.register(values)
      await ensureCsrf(true)
      setUser(user)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (e) {
      applyServerErrors(e, form.setError, ['full_name', 'email', 'password', 'workspace_name'])
    }
  })

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building with a free WebMindClub workspace."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="font-medium text-brand-blue hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="full_name" error={errors.full_name?.message}>
          <Input id="full_name" autoComplete="name" aria-invalid={!!errors.full_name} {...form.register('full_name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...form.register('email')} />
        </Field>
        <Field label="Workspace name" htmlFor="workspace_name" hint="Optional — you can rename it later." error={errors.workspace_name?.message}>
          <Input id="workspace_name" placeholder="Acme Studio" {...form.register('workspace_name')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters, not entirely numeric or too common.">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register('confirm')} />
        </Field>
        <Button type="submit" variant="gradient" className="w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
