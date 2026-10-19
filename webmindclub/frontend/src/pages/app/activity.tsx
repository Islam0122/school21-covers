import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Activity as ActivityIcon, Search } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { ActivityList } from '@/features/activity/activity-list'
import { qk, useCurrentWorkspace } from '@/hooks/use-workspace'
import { useDebounce } from '@/hooks/use-debounce'
import { activityApi } from '@/services/api'

export default function ActivityPage() {
  const { workspace } = useCurrentWorkspace()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search)
  const query = { workspace: workspace!.id, page, search: debounced }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: qk.activity(query), queryFn: () => activityApi.list(query), placeholderData: keepPreviousData })
  return (
    <div className="animate-fade-in">
      <PageHeader title="Activity" description="Audit trail of important changes in this workspace." />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} placeholder="Filter activity" className="pl-9" aria-label="Filter activity" />
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <LoadingState />
      ) : data.results.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity" description="Actions on projects, pages, tasks and members will appear here." />
      ) : (
        <Card>
          <CardContent>
            <ActivityList items={data.results} />
            <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-sm text-muted">
              <span>{data.count} events</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
