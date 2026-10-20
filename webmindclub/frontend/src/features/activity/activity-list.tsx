import { Link } from 'react-router'
import { Avatar } from '@/components/ui/avatar'
import { timeAgo } from '@/lib/utils'
import type { Activity } from '@/types'

export function ActivityList({ items, showProject = true }: { items: Activity[]; showProject?: boolean }) {
  return (
    <ol className="space-y-4">
      {items.map((a) => (
        <li key={a.id} className="flex gap-3">
          <Avatar name={a.actor?.display_name ?? 'System'} src={a.actor?.avatar} className="size-8" />
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <strong className="font-medium">{a.actor?.display_name ?? 'System'}</strong> <span className="text-muted">{a.message}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {timeAgo(a.created_at)}
              {showProject && a.project && a.project_name && (
                <>
                  {' · '}
                  <Link className="hover:text-fg hover:underline" to={`/app/projects/${a.project}`}>
                    {a.project_name}
                  </Link>
                </>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
