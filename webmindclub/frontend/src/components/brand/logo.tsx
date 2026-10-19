import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return <img src="/brand/wm-symbol.png" alt="" aria-hidden className={cn('size-8 object-contain', className)} />
}

export function Logo({ to = '/', className, tagline }: { to?: string; className?: string; tagline?: boolean }) {
  return (
    <Link to={to} className={cn('flex items-center gap-2.5', className)} aria-label="WebMindClub home">
      <LogoMark />
      <span className="leading-none">
        <span className="font-display text-lg font-extrabold tracking-tight">
          Web<span className="text-gradient">Mind</span>Club
        </span>
        {tagline && (
          <span className="mt-1 block text-[9px] font-medium tracking-[0.3em] text-muted">CREATE • DEVELOP • LAUNCH</span>
        )}
      </span>
    </Link>
  )
}
