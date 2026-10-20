import { zodResolver } from '@hookform/resolvers/zod'
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/input'
import { applyServerErrors, errorMessage } from '@/lib/forms'
import { authApi } from '@/services/api'
import { useAuth } from '@/stores/auth'

const schema = z.object({ full_name: z.string().trim().min(2, 'Enter your full name.').max(150) })

export function ProfileForm() {
  const { user, setUser } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const form = useForm<{ full_name: string }>({ resolver: zodResolver(schema), defaultValues: { full_name: user?.full_name ?? '' } })
  if (!user) return null
  const onSubmit = form.handleSubmit(async (v) => {
    try {
      setUser(await authApi.updateMe(v))
      toast.success('Profile updated')
    } catch (e) {
      applyServerErrors(e, form.setError, ['full_name'])
    }
  })
  const uploadAvatar = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error('Avatar must be smaller than 5 MB.')
    const fd = new FormData()
    fd.append('avatar', file)
    setUploading(true)
    try {
      setUser(await authApi.updateMe(fd))
      toast.success('Avatar updated')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={user.display_name} src={user.avatar} className="size-16 text-lg" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload /> Upload avatar
          </Button>
          {user.avatar && (
            <Button variant="ghost" size="sm" onClick={async () => setUser(await authApi.updateMe({ avatar: '' } as never))}>
              Remove
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadAvatar(e.target.files[0])} />
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="pf-name" error={form.formState.errors.full_name?.message}>
          <Input id="pf-name" {...form.register('full_name')} />
        </Field>
        <Field label="Email" htmlFor="pf-email" hint="Email is your login and cannot be changed here.">
          <Input id="pf-email" value={user.email} readOnly disabled />
        </Field>
        <Button type="submit" loading={form.formState.isSubmitting}>
          Save profile
        </Button>
      </form>
    </div>
  )
}
