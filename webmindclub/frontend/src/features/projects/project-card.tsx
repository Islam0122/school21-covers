import { Globe, Lock, Package } from 'lucide-react'
import { Link } from 'react-router'
import { AvatarStack } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { statusTone } from '@/lib/labels'
import { timeAgo } from '@/lib/utils'
import type { Project } from '@/types'
import { ProjectActions } from './project-actions'

export function ProjectIcon({ project, className = 'size-10' }: { project: Project; className?: string }) {
  if (project.logo) return <img src={project.logo} alt="" className={`${className} rounded-xl object-cover`} />
  return (
    <span className={`${className} inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-gradient font-display text-sm font-bold text-white`}>
      {project.has_store ? <Package className="size-5" /> : project.name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="group relative flex flex-col rounded-card border border-line bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-brand-blue/50 hover:shadow-lg hover:shadow-blue-950/10">
      <div className="flex items-start justify-between gap-3">
        <ProjectIcon project={project} />
        <div className="relative z-10">
          <ProjectActions project={project} />
        </div>
      </div>
      <Link to={`/app/projects/${project.id}`} className="mt-4 after:absolute after:inset-0">
        <h3 className="font-display font-semibold">{project.name}</h3>
      </Link>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{project.description || 'No description yet.'}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(project.status)}>{project.status_label}</Badge>
        <Badge>{project.type_label}</Badge>
        <span className="text-muted" title={project.visibility === 'private' ? 'Private' : 'Visible to workspace'}>
          {project.visibility === 'private' ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
        <AvatarStack users={project.members} />
        <span className="text-xs text-muted">Updated {timeAgo(project.updated_at)}</span>
      </div>
    </div>
  )
}
