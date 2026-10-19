import { zodResolver } from '@hookform/resolvers/zod'
import { Info, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/forms'
import { authApi } from '@/services/api'
import { AuthShell } from './auth-shell'

const schema = z.object({ email: z.email('Enter a valid email address.') })

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{ detail: string; email_delivery_configured: boolean } | null>(null)
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      setResult(await authApi.requestReset(email))
    } catch (e) {
      applyServerErrors(e, form.setError, ['email'])
    }
  })
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your account email and we’ll generate a reset link."
      footer={
        <Link to="/signin" className="font-medium text-brand-blue hover:underline">
          Back to sign in
        </Link>
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
            <MailCheck className="size-5 shrink-0 text-emerald-500" />
            <p>{result.detail}</p>
          </div>
          {!result.email_delivery_configured && (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <Info className="size-5 shrink-0 text-amber-500" />
              <p>
                Email delivery is not configured in this environment. The reset link is written to the backend server log
                (Django console email backend). Configure SMTP via <code>DJANGO_EMAIL_BACKEND</code> to send real emails.
              </p>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Button type="submit" variant="gradient" className="w-full" loading={form.formState.isSubmitting}>
            Generate reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
