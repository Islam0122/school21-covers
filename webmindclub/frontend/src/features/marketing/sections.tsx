import {
  ArrowRight, BarChart3, Boxes, Check, Eye, LayoutTemplate, MousePointerClick, Package, Rocket, Sparkles,
  TrendingDown, Users, Wand2,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const FEATURES = [
  { icon: Wand2, title: 'Visual Website Builder', text: 'Compose pages from a safe library of sections, tune every property and see changes instantly.' },
  { icon: Boxes, title: 'Project Workspace', text: 'Every product gets its own home: brief, pages, design, tasks, team and activity in one place.' },
  { icon: Users, title: 'Team Collaboration', text: 'Invite designers, developers and PMs with precise roles and per-project access.' },
  { icon: Eye, title: 'Live Preview', text: 'Switch between desktop, tablet and mobile and review the real render before you ship.' },
  { icon: LayoutTemplate, title: 'Product Templates', text: 'Start from SaaS, e-commerce, landing or portfolio templates with ready-made pages.' },
  { icon: Rocket, title: 'Launch Workflow', text: 'Publish versioned snapshots, keep a publication history and unpublish in one click.' },
]

const VIZ_TABS = ['Projects', 'Components', 'Preview'] as const

function WorkspaceVisual() {
  const [tab, setTab] = useState<(typeof VIZ_TABS)[number]>('Projects')
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div className="relative">
      <div className="absolute -inset-8 -z-10 rounded-[40px] bg-brand-gradient opacity-20 blur-3xl" />
      <div className="rounded-2xl border border-line bg-surface/90 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <div role="tablist" aria-label="Workspace preview" className="flex gap-1 rounded-lg bg-bg/60 p-0.5">
            {VIZ_TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer', tab === t ? 'bg-elevated text-fg shadow' : 'text-muted hover:text-fg')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[340px] p-4">
          {tab === 'Projects' && (
            <div className="grid h-full grid-cols-2 gap-3 animate-fade-in">
              {[
                { name: 'SmartStock AI', type: 'SaaS', status: 'In Progress', tone: 'blue' as const, progress: 72 },
                { name: 'Retail Landing', type: 'Landing Page', status: 'Published', tone: 'green' as const, progress: 100 },
                { name: 'Team Portal', type: 'Internal Tool', status: 'Review', tone: 'amber' as const, progress: 88 },
                { name: 'Fresh Market', type: 'E-commerce', status: 'Draft', tone: 'neutral' as const, progress: 24 },
              ].map((p, i) => (
                <div
                  key={p.name}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className={cn('flex flex-col justify-between rounded-xl border border-line bg-elevated p-3 transition-all', hovered === i && '-translate-y-1 border-brand-blue/60 shadow-lg shadow-blue-900/20')}
                >
                  <div>
                    <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-white">
                      {i === 0 ? <Package className="size-4" /> : <Boxes className="size-4" />}
                    </div>
                    <p className="text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">{p.type}</p>
                  </div>
                  <div>
                    <Badge tone={p.tone} className="mb-2">{p.status}</Badge>
                    <div className="h-1.5 rounded-full bg-hover">
                      <div className="h-full rounded-full bg-brand-gradient transition-all" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'Components' && (
            <div className="grid h-full grid-cols-3 gap-2 animate-fade-in">
              {['Navbar', 'Hero', 'Features', 'Pricing', 'Stats', 'FAQ', 'Products', 'Contact', 'Footer'].map((c) => (
                <div key={c} className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-elevated p-2 text-xs font-medium transition-colors hover:border-brand-cyan/60">
                  <MousePointerClick className="size-4 text-muted transition-colors group-hover:text-brand-cyan" />
                  {c}
                </div>
              ))}
            </div>
          )}
          {tab === 'Preview' && (
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white text-slate-900 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-[10px] font-semibold">
                <span>SmartStock AI</span>
                <span className="flex gap-3 text-slate-500">
                  <span>Features</span>
                  <span>Pricing</span>
                  <span className="rounded bg-blue-600 px-2 py-0.5 text-white">Request demo</span>
                </span>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-6 text-center">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-600">AI-powered retail</span>
                <p className="mt-1 font-display text-lg font-bold leading-tight">Inventory intelligence for modern retail</p>
                <p className="mt-1 text-[10px] text-slate-500">Predict stockouts. Cut waste. Order smarter.</p>
                <div className="mt-3 grid w-full grid-cols-3 gap-2">
                  {['−32% stockouts', '−18% waste', '4h saved'].map((s) => (
                    <div key={s} className="rounded-lg border border-slate-200 bg-white py-2 text-[10px] font-semibold">
                      {s}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-line bg-elevated p-3 shadow-xl animate-float sm:block">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="size-4 text-brand-cyan" />
          <span className="font-medium">Published v3</span>
          <Badge tone="green">Live</Badge>
        </div>
      </div>
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.18),transparent_60%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:pt-24">
        <div>
          <Badge tone="blue" className="mb-5">
            <Sparkles className="size-3" /> Digital product studio platform
          </Badge>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Turn Ideas Into <span className="text-gradient">Real Products.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">Design, build and launch digital products with one connected workspace.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="gradient" size="lg">
              <Link to="/platform">
                Explore Platform <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/projects">View Our Projects</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm text-muted">
            {['Visual builder', 'Versioned publishing', 'Role-based access'].map((t) => (
              <span key={t} className="flex items-center gap-2">
                <Check className="size-4 text-brand-cyan" /> {t}
              </span>
            ))}
          </div>
        </div>
        <WorkspaceVisual />
      </div>
    </section>
  )
}

export function FeatureGrid({ title = 'One platform, from idea to launch', id }: { title?: string; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-cyan">Platform</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-4 text-muted">Everything your team needs to move a product from concept to a working MVP.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="group rounded-card border border-line bg-surface p-6 transition-all hover:-translate-y-1 hover:border-brand-blue/50 hover:shadow-xl hover:shadow-blue-950/20">
            <div className="mb-4 inline-flex rounded-xl bg-brand-blue/10 p-2.5 text-brand-blue transition-colors group-hover:bg-brand-gradient group-hover:text-white">
              <Icon className="size-5" />
            </div>
            <h3 className="font-display font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function FeaturedProject() {
  const bars = [42, 55, 48, 62, 58, 71, 66, 80, 74, 88, 82, 94]
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="grid items-center gap-12 overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10 lg:grid-cols-2">
        <div>
          <Badge tone="purple">Featured project · First WebMindClub product</Badge>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">SmartStock AI</h2>
          <p className="mt-3 text-lg text-muted">AI-powered inventory intelligence for modern retail.</p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              'Live inventory with prices, minimum stock and expiry dates',
              'Explainable stockout, overstock and expiry-risk insights',
              'Recommended purchase quantities based on real sales velocity',
              'Purchase orders that update stock when goods arrive',
            ].map((f) => (
              <li key={f} className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-cyan" /> {f}
              </li>
            ))}
          </ul>
          <Button asChild variant="gradient" className="mt-8">
            <Link to="/app/projects">
              Open Project <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="rounded-2xl border border-line bg-bg p-4 shadow-inner">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <BarChart3 className="size-4 text-brand-blue" /> Store dashboard
            </span>
            <Badge tone="cyan">Demo data</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Inventory value', '$4,812'],
              ['Low stock', '6 items'],
              ['Potential savings', '$312'],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-surface p-3">
                <p className="text-[11px] text-muted">{k}</p>
                <p className="mt-1 font-display text-lg font-bold">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-28 items-end gap-1.5 rounded-xl border border-line bg-surface p-3">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-brand-gradient opacity-80" style={{ height: `${h}%` }} />
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {[
              { icon: TrendingDown, tone: 'red' as const, t: 'Stockout risk: Whole Milk 1L', d: 'Covers ~3 days; lead time 2 days. Order 120 units.' },
              { icon: Package, tone: 'amber' as const, t: 'Overstock: Basmati Rice 2kg', d: '~137 days of stock. Pause reordering, run a promotion.' },
            ].map(({ icon: Icon, tone, t, d }) => (
              <div key={t} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                <Badge tone={tone} className="size-7 justify-center rounded-lg p-0">
                  <Icon className="size-3.5" />
                </Badge>
                <div>
                  <p className="text-xs font-semibold">{t}</p>
                  <p className="text-[11px] text-muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  { title: 'Create a project', text: 'Pick a type and template, set your brand colors and fonts.' },
  { title: 'Design the experience', text: 'Arrange sections in the visual builder and fine-tune the theme.' },
  { title: 'Build your product', text: 'Plan tasks on a Kanban board and collaborate with your team.' },
  { title: 'Preview and launch', text: 'Review on every device, publish a version and share the URL.' },
]

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-purple">How it works</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">From idea to launch in four steps</h2>
      </div>
      <ol className="mt-12 grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-card border border-line bg-surface p-6">
            <span className="font-display text-4xl font-extrabold text-gradient">{i + 1}</span>
            <h3 className="mt-3 font-display font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function CallToAction() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-10 text-center text-white sm:p-14">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Ready to build your next product?</h2>
        <p className="mx-auto mt-3 max-w-xl text-white/80">Create a free workspace and launch your first project today.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-white/90">
            <Link to="/signup">Get Started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
            <Link to="/platform">Explore Platform</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
