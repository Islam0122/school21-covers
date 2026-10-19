import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'bg-slate-500/15 text-slate-500 dark:text-slate-300',
      blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
      cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
      purple: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
      green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      red: 'bg-red-500/15 text-red-600 dark:text-red-300',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
