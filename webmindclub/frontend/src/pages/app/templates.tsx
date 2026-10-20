import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { TEMPLATES } from '@/features/projects/templates'

export default function TemplatesPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Templates" description="Start new projects from ready-made page structures and themes." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map(({ key, name, description, icon: Icon, pages, colors }) => (
          <div key={key} className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className="relative flex h-36 items-center justify-center" style={{ background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})` }}>
              <div className="w-3/4 rounded-lg bg-white/95 p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="h-2 w-10 rounded bg-slate-300" />
                  <span className="h-2 w-16 rounded bg-slate-200" />
                </div>
                <div className="h-2 w-2/3 rounded bg-slate-800" />
                <div className="mt-1.5 h-2 w-1/2 rounded bg-slate-300" />
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-6 rounded bg-slate-100" />
                  ))}
                </div>
              </div>
              <Icon className="absolute right-3 top-3 size-5 text-white/80" />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h3 className="font-display font-semibold">{name}</h3>
              <p className="mt-1 flex-1 text-sm text-muted">{description}</p>
              <p className="mt-3 text-xs text-muted">Pages: {pages.join(' · ')}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to={`/app/projects/new?template=${key}`}>
                  Use template <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
