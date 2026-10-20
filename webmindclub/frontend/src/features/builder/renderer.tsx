/**
 * Safe site renderer. Renders only allow-listed component types; all user text is
 * rendered as React text nodes (never as HTML) and links are re-validated client side.
 */
import { ImageIcon, Mail, MapPin, Phone, Check } from 'lucide-react'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Block, Device, ThemeTokens } from '@/types'
import { ensureFonts } from './fonts'
import { ICONS } from './icons'

export interface RenderContext {
  theme: ThemeTokens
  /** Turns a stored href into a navigable target; return null to render a non-interactive element. */
  resolveLink?: (href: string) => { href: string; internal: boolean; onClick?: (e: React.MouseEvent) => void } | null
  editing?: boolean
}

const SAFE_LINK = /^(\/(?!\/)\S*|#[\w-]*|https?:\/\/\S+|mailto:\S+|tel:[+\d\-\s()]+)$/i
const SAFE_IMG = /^(https?:\/\/[^\s"'<>]+|\/media\/[\w\-./]+)$/i

function SiteLink({ ctx, href, className, style, children }: { ctx: RenderContext; href: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  if (!href || !SAFE_LINK.test(href) || ctx.editing || !ctx.resolveLink) {
    return (
      <span className={className} style={style}>
        {children}
      </span>
    )
  }
  const target = ctx.resolveLink(href)
  if (!target) return <span className={className} style={style}>{children}</span>
  const external = /^https?:/i.test(href)
  return (
    <a href={target.href} onClick={target.onClick} className={className} style={style} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
      {children}
    </a>
  )
}

function SiteButton({ ctx, label, href, variant = 'primary' }: { ctx: RenderContext; label: string; href: string; variant?: string }) {
  if (!label) return null
  const { theme } = ctx
  const radius = theme.buttonStyle === 'pill' ? 999 : Math.min(theme.radius, 14)
  const outline = variant === 'outline' || (theme.buttonStyle === 'outline' && variant === 'primary')
  const color = variant === 'secondary' ? theme.secondary : theme.primary
  const style: CSSProperties = outline
    ? { border: `1.5px solid ${color}`, color, borderRadius: radius }
    : { background: color, color: '#fff', borderRadius: radius, border: `1.5px solid ${color}` }
  return (
    <SiteLink ctx={ctx} href={href} style={style} className="inline-flex items-center justify-center px-[1.25em] py-[0.65em] text-[0.95em] font-semibold transition-opacity hover:opacity-90">
      {label}
    </SiteLink>
  )
}

function SiteImage({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: CSSProperties }) {
  if (src && SAFE_IMG.test(src)) return <img src={src} alt={alt} className={cn('object-cover', className)} style={style} loading="lazy" />
  return (
    <div className={cn('flex items-center justify-center', className)} style={{ background: 'color-mix(in srgb, currentColor 8%, transparent)', ...style }} aria-label={alt || 'Image placeholder'} role="img">
      <ImageIcon className="size-8 opacity-40" />
    </div>
  )
}

const WIDTHS = { narrow: 720, normal: 0, wide: 1400, full: 0 }

function blockBody(block: Block, ctx: RenderContext): ReactNode {
  const p = block.props
  const { theme } = ctx
  const muted = { color: theme.mutedText }
  const card: CSSProperties = { background: theme.surface, borderRadius: theme.radius, border: `1px solid color-mix(in srgb, ${theme.text} 10%, transparent)` }
  const heading: CSSProperties = { fontFamily: `'${theme.headingFont}', sans-serif` }
  const justify = block.style.align === 'center' ? 'justify-center' : block.style.align === 'right' ? 'justify-end' : 'justify-start'

  switch (block.type) {
    case 'navbar':
      return (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SiteLink ctx={ctx} href="/" className="text-[1.15em] font-bold" style={heading}>
            {p.brand}
          </SiteLink>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.95em]">
            {(p.links as { label: string; href: string }[]).map((l, i) => (
              <SiteLink key={i} ctx={ctx} href={l.href} className="opacity-80 hover:opacity-100">
                {l.label}
              </SiteLink>
            ))}
            <SiteButton ctx={ctx} label={p.ctaLabel} href={p.ctaHref} />
          </nav>
        </div>
      )
    case 'hero':
      return (
        <div className={cn('grid items-center gap-10', p.image && '@3xl:grid-cols-2')}>
          <div>
            {p.eyebrow && (
              <p className="mb-4 text-[0.8em] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.primary }}>
                {p.eyebrow}
              </p>
            )}
            <h1 className="text-[2.4em] font-extrabold leading-[1.08] tracking-tight @3xl:text-[3.4em]" style={heading}>
              {p.heading}
            </h1>
            {p.subheading && (
              <p className="mt-5 text-[1.15em] leading-relaxed" style={{ ...muted, marginInline: block.style.align === 'center' && !p.image ? 'auto' : undefined, maxWidth: '42em' }}>
                {p.subheading}
              </p>
            )}
            <div className={cn('mt-8 flex flex-wrap gap-3', !p.image && justify)}>
              <SiteButton ctx={ctx} label={p.primaryLabel} href={p.primaryHref} />
              <SiteButton ctx={ctx} label={p.secondaryLabel} href={p.secondaryHref} variant="outline" />
            </div>
          </div>
          {p.image && <SiteImage src={p.image} alt={p.heading} className="aspect-[4/3] w-full" style={{ borderRadius: theme.radius }} />}
        </div>
      )
    case 'heading': {
      const Tag = (p.level as 'h1' | 'h2' | 'h3') ?? 'h2'
      const size = { h1: 'text-[2.6em]', h2: 'text-[2em]', h3: 'text-[1.5em]' }[Tag]
      return (
        <Tag className={cn(size, 'font-bold tracking-tight leading-tight')} style={heading}>
          {p.text}
        </Tag>
      )
    }
    case 'paragraph':
      return (
        <p className="whitespace-pre-line text-[1.05em] leading-relaxed" style={muted}>
          {p.text}
        </p>
      )
    case 'image':
      return (
        <figure>
          <SiteImage src={p.src} alt={p.alt} className="w-full" style={{ height: p.height, borderRadius: theme.radius }} />
          {p.caption && <figcaption className="mt-2 text-[0.85em]" style={muted}>{p.caption}</figcaption>}
        </figure>
      )
    case 'button':
      return (
        <div className={cn('flex', justify)}>
          <SiteButton ctx={ctx} label={p.label} href={p.href} variant={p.variant} />
        </div>
      )
    case 'features': {
      const cols = { '2': '@2xl:grid-cols-2', '3': '@2xl:grid-cols-2 @4xl:grid-cols-3', '4': '@2xl:grid-cols-2 @4xl:grid-cols-4' }[p.columns as '2' | '3' | '4']
      return (
        <div>
          {p.title && <h2 className="text-[2em] font-bold tracking-tight" style={heading}>{p.title}</h2>}
          {p.subtitle && <p className="mt-3 text-[1.05em]" style={muted}>{p.subtitle}</p>}
          <div className={cn('mt-10 grid gap-5 text-left', cols)}>
            {(p.items as { icon: string; title: string; text: string }[]).map((it, i) => {
              const Icon = ICONS[it.icon] ?? ICONS.sparkles
              return (
                <div key={i} className="p-6" style={card}>
                  <span className="mb-4 inline-flex rounded-xl p-2.5" style={{ background: `color-mix(in srgb, ${theme.primary} 14%, transparent)`, color: theme.primary }}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-[1.1em] font-semibold" style={heading}>{it.title}</h3>
                  <p className="mt-2 text-[0.95em] leading-relaxed" style={muted}>{it.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    case 'products':
      return (
        <div>
          {p.title && <h2 className="text-[2em] font-bold tracking-tight" style={heading}>{p.title}</h2>}
          <div className="mt-8 grid gap-5 text-left @xl:grid-cols-2 @4xl:grid-cols-3">
            {(p.items as { name: string; price: string; image: string; badge: string }[]).map((it, i) => (
              <div key={i} className="overflow-hidden" style={card}>
                <div className="relative">
                  <SiteImage src={it.image} alt={it.name} className="aspect-[4/3] w-full" />
                  {it.badge && (
                    <span className="absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[0.75em] font-semibold text-white" style={{ background: theme.secondary }}>
                      {it.badge}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between p-4">
                  <span className="font-medium">{it.name}</span>
                  <span className="font-semibold" style={{ color: theme.primary }}>{it.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    case 'stats':
      return (
        <div className="grid gap-6 @xl:grid-cols-3">
          {(p.items as { value: string; label: string }[]).map((it, i) => (
            <div key={i}>
              <p className="text-[2.6em] font-extrabold" style={{ ...heading, color: theme.primary }}>{it.value}</p>
              <p className="mt-1" style={muted}>{it.label}</p>
            </div>
          ))}
        </div>
      )
    case 'testimonials':
      return (
        <div>
          {p.title && <h2 className="text-[2em] font-bold tracking-tight" style={heading}>{p.title}</h2>}
          <div className="mt-8 grid gap-5 text-left @2xl:grid-cols-2 @4xl:grid-cols-3">
            {(p.items as { quote: string; author: string; role: string }[]).map((it, i) => (
              <figure key={i} className="p-6" style={card}>
                <blockquote className="text-[1.05em] leading-relaxed">“{it.quote}”</blockquote>
                <figcaption className="mt-4 text-[0.9em]">
                  <span className="font-semibold">{it.author}</span> <span style={muted}>· {it.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )
    case 'pricing':
      return (
        <div>
          {p.title && <h2 className="text-[2em] font-bold tracking-tight" style={heading}>{p.title}</h2>}
          <div className={cn('mt-8 grid gap-5 text-left @2xl:grid-cols-2', (p.items as unknown[]).length > 2 && '@4xl:grid-cols-3')}>
            {(p.items as { name: string; price: string; period: string; features: string; highlighted: boolean; ctaLabel: string; ctaHref: string }[]).map((it, i) => (
              <div key={i} className="flex flex-col p-7" style={{ ...card, ...(it.highlighted ? { border: `2px solid ${theme.primary}` } : {}) }}>
                <p className="font-semibold">{it.name}</p>
                <p className="mt-3">
                  <span className="text-[2.4em] font-extrabold" style={heading}>{it.price}</span>
                  <span style={muted}>{it.period}</span>
                </p>
                <ul className="my-6 flex-1 space-y-2 text-[0.95em]">
                  {it.features.split('\n').filter(Boolean).map((f, j) => (
                    <li key={j} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0" style={{ color: theme.primary }} /> {f}
                    </li>
                  ))}
                </ul>
                <SiteButton ctx={ctx} label={it.ctaLabel} href={it.ctaHref} variant={it.highlighted ? 'primary' : 'outline'} />
              </div>
            ))}
          </div>
        </div>
      )
    case 'faq':
      return (
        <div className="text-left">
          {p.title && <h2 className="mb-6 text-[2em] font-bold tracking-tight" style={{ ...heading, textAlign: block.style.align }}>{p.title}</h2>}
          <div className="space-y-3">
            {(p.items as { question: string; answer: string }[]).map((it, i) => (
              <details key={i} className="group p-5" style={card} open={ctx.editing && i === 0}>
                <summary className="cursor-pointer list-none font-semibold">{it.question}</summary>
                <p className="mt-3 whitespace-pre-line text-[0.95em] leading-relaxed" style={muted}>{it.answer}</p>
              </details>
            ))}
          </div>
        </div>
      )
    case 'contact':
      return (
        <div className="grid gap-8 text-left @3xl:grid-cols-2">
          <div>
            <h2 className="text-[2em] font-bold tracking-tight" style={heading}>{p.title}</h2>
            <p className="mt-3 text-[1.05em]" style={muted}>{p.text}</p>
            {p.email && (
              <div className="mt-6">
                <SiteButton ctx={ctx} label={p.buttonLabel} href={`mailto:${p.email}`} />
              </div>
            )}
          </div>
          <ul className="space-y-4 p-6" style={card}>
            {p.email && <li className="flex items-center gap-3"><Mail className="size-4" style={{ color: theme.primary }} /> {p.email}</li>}
            {p.phone && <li className="flex items-center gap-3"><Phone className="size-4" style={{ color: theme.primary }} /> {p.phone}</li>}
            {p.address && <li className="flex items-center gap-3"><MapPin className="size-4" style={{ color: theme.primary }} /> {p.address}</li>}
          </ul>
        </div>
      )
    case 'footer':
      return (
        <div className="flex flex-col gap-4 border-t pt-8 text-[0.9em] @2xl:flex-row @2xl:items-center @2xl:justify-between" style={{ borderColor: `color-mix(in srgb, ${theme.text} 12%, transparent)` }}>
          <div>
            <p className="font-bold" style={heading}>{p.brand}</p>
            <p className="mt-1" style={muted}>{p.text}</p>
          </div>
          <nav className="flex flex-wrap gap-5">
            {(p.links as { label: string; href: string }[]).map((l, i) => (
              <SiteLink key={i} ctx={ctx} href={l.href} className="opacity-80 hover:opacity-100">
                {l.label}
              </SiteLink>
            ))}
          </nav>
        </div>
      )
    case 'spacer':
      return <div style={{ height: p.height }} aria-hidden />
    case 'divider':
      return <hr style={{ borderTop: `${p.thickness}px solid color-mix(in srgb, ${theme.text} 15%, transparent)` }} />
    default:
      return null
  }
}

export function BlockView({ block, ctx }: { block: Block; ctx: RenderContext }) {
  const s = block.style
  const maxWidth = s.width === 'full' ? undefined : s.width === 'normal' ? ctx.theme.containerWidth : WIDTHS[s.width]
  return (
    <section
      data-block-type={block.type}
      style={{
        paddingTop: s.paddingTop,
        paddingBottom: s.paddingBottom,
        background: s.background || undefined,
        color: s.textColor || undefined,
        textAlign: s.align,
        fontSize: `${s.fontScale}%`,
        borderTop: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor || 'currentColor'}` : undefined,
        borderBottom: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor || 'currentColor'}` : undefined,
        borderRadius: s.radius || undefined,
      }}
    >
      <div className="mx-auto px-6" style={{ maxWidth }}>
        {blockBody(block, ctx)}
      </div>
    </section>
  )
}

export function isBlockVisible(block: Block, device: Device) {
  return !block.hidden && !block.hiddenOn.includes(device)
}

/** Root wrapper: applies theme tokens and establishes the container for responsive rules. */
export function SiteFrame({ theme, children, className }: { theme: ThemeTokens; children: ReactNode; className?: string }) {
  useEffect(() => ensureFonts(theme.headingFont, theme.bodyFont), [theme.headingFont, theme.bodyFont])
  return (
    <div
      className={cn('@container min-h-full', className)}
      style={{ background: theme.background, color: theme.text, fontFamily: `'${theme.bodyFont}', sans-serif` }}
    >
      {children}
    </div>
  )
}

export function SiteRenderer({ blocks, ctx, device = 'desktop' }: { blocks: Block[]; ctx: RenderContext; device?: Device }) {
  return (
    <SiteFrame theme={ctx.theme}>
      {blocks.filter((b) => isBlockVisible(b, device)).map((b) => (
        <BlockView key={b.id} block={b} ctx={ctx} />
      ))}
    </SiteFrame>
  )
}
