import type * as React from 'react'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'blue',
}: {
  label: string
  value: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  hint?: string
  tone?: 'blue' | 'cyan' | 'purple' | 'green' | 'amber' | 'red'
}) {
  const tones = {
    blue: 'bg-blue-500/12 text-blue-500',
    cyan: 'bg-cyan-500/12 text-cyan-500',
    purple: 'bg-violet-500/12 text-violet-500',
    green: 'bg-emerald-500/12 text-emerald-500',
    amber: 'bg-amber-500/12 text-amber-500',
    red: 'bg-red-500/12 text-red-500',
  }
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cn('rounded-lg p-2', tones[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
