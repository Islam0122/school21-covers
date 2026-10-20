import { cn, initials } from '@/lib/utils'

const palette = ['bg-blue-600', 'bg-cyan-600', 'bg-violet-600', 'bg-indigo-600', 'bg-sky-600', 'bg-fuchsia-600']

export function Avatar({
  name,
  src,
  className,
}: {
  name: string
  src?: string | null
  className?: string
}) {
  const color = palette[name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length]
  if (src) return <img src={src} alt={name} className={cn('size-8 rounded-full object-cover', className)} />
  return (
    <span
      title={name}
      className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white', color, className)}
    >
      {initials(name) || '?'}
    </span>
  )
}

export function AvatarStack({ users, max = 4 }: { users: { id: number; display_name: string; avatar?: string | null }[]; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {users.slice(0, max).map((u) => (
        <Avatar key={u.id} name={u.display_name} src={u.avatar} className="size-7 ring-2 ring-surface" />
      ))}
      {users.length > max && (
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-hover text-[10px] font-semibold ring-2 ring-surface">
          +{users.length - max}
        </span>
      )}
    </div>
  )
}
