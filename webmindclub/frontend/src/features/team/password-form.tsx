import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { applyServerErrors } from '@/lib/forms'
import { authApi } from '@/services/api'
import { ensureCsrf } from '@/services/http'

const schema = z
  .object({ current_password: z.string().min(1, 'Enter your current password.'), new_password: z.string().min(8, 'Use at least 8 characters.'), confirm: z.string() })
  .refine((v) => v.new_password === v.confirm, { path: ['confirm'], message: 'Passwords do not match.' })

export function PasswordForm() {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { current_password: '', new_password: '', confirm: '' } })
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async ({ confirm: _c, ...v }) => {
    try {
      await authApi.changePassword(v)
      await ensureCsrf(true)
      form.reset()
      toast.success('Password changed')
    } catch (e) {
      applyServerErrors(e, form.setError, ['current_password', 'new_password'])
    }
  })
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <Field label="Current password" htmlFor="cur-pw" error={errors.current_password?.message}>
        <Input id="cur-pw" type="password" autoComplete="current-password" {...form.register('current_password')} />
      </Field>
      <Field label="New password" htmlFor="new-pw" error={errors.new_password?.message}>
        <Input id="new-pw" type="password" autoComplete="new-password" {...form.register('new_password')} />
      </Field>
      <Field label="Confirm new password" htmlFor="conf-pw" error={errors.confirm?.message}>
        <Input id="conf-pw" type="password" autoComplete="new-password" {...form.register('confirm')} />
      </Field>
      <Button type="submit" loading={isSubmitting}>
        Change password
      </Button>
    </form>
  )
}
