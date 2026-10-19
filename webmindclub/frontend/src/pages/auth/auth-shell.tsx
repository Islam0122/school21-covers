import type * as React from 'react'
import { Logo } from '@/components/brand/logo'

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-line bg-surface lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(6,182,212,0.25),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(124,58,237,0.3),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center p-12 text-center">
          <img src="/brand/wm-symbol.png" alt="" className="size-40 animate-float drop-shadow-2xl" />
          <p className="mt-8 font-display text-3xl font-bold">
            Create. Develop. <span className="text-gradient">Launch.</span>
          </p>
          <p className="mt-3 max-w-sm text-muted">One connected workspace for designing, building and shipping digital products.</p>
        </div>
      </div>
    </div>
  )
}
