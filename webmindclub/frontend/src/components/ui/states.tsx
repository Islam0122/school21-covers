import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-hover', className)} />
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-16 text-sm text-muted', className)}>
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-card border border-dashed border-line px-6 py-14 text-center', className)}>
      <div className="mb-4 rounded-2xl bg-brand-blue/10 p-3 text-brand-blue">
        <Icon className="size-6" />
      </div>
      <h3 className="font-display font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center rounded-card border border-red-500/30 bg-red-500/5 px-6 py-12 text-center', className)}>
      <AlertTriangle className="mb-3 size-6 text-red-500" />
      <h3 className="font-display font-semibold">Couldn’t load this</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      )}
    </div>
  )
}
