import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, PackageX, RefreshCw, ShoppingCart, Sparkles, TrendingDown, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { errorMessage } from '@/lib/forms'
import { formatMoney } from '@/lib/utils'
import { smartstockApi } from '@/services/api'
import type { Recommendation } from '@/types'
import { canWrite, ssk, useStore } from './context'

const KIND = {
  stockout: { icon: TrendingDown, tone: 'red' as const },
  reorder: { icon: ShoppingCart, tone: 'blue' as const },
  overstock: { icon: PackageX, tone: 'amber' as const },
  expiry: { icon: Clock, tone: 'purple' as const },
}
const SEVERITY = { high: 'red', medium: 'amber', low: 'neutral' } as const

export function InsightCard({ rec, compact }: { rec: Recommendation; compact?: boolean }) {
  const store = useStore()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const k = KIND[rec.kind]
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['smartstock', store.id] })
  }
  const dismiss = useMutation({ mutationFn: () => smartstockApi.dismiss(rec.id), onSuccess: () => (refresh(), toast.success('Insight dismissed')), onError: (e) => toast.error(errorMessage(e)) })
  const order = useMutation({
    mutationFn: () => smartstockApi.orderFromInsight(rec.id),
    onSuccess: (o) => {
      refresh()
      toast.success(`Draft PO-${o.id} created`)
      navigate(`/smartstock/${store.id}/orders`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <article className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <Badge tone={k.tone} className="size-8 shrink-0 justify-center rounded-lg p-0">
          <k.icon className="size-4" />
        </Badge>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{rec.title}</h3>
            <Badge tone={SEVERITY[rec.severity]} className="capitalize">{rec.severity}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">{rec.sku} · {rec.kind_label}</p>
          <p className="mt-3 text-sm"><span className="font-medium">Why: </span><span className="text-muted">{rec.reason}</span></p>
          <p className="mt-2 text-sm"><span className="font-medium">Action: </span>{rec.action}</p>
          {!compact && (
            <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              <div>Avg sales: <span className="text-fg">{rec.metrics.avg_daily_sales}/day</span></div>
              <div>Stock: <span className="text-fg">{rec.metrics.stock}</span></div>
              <div>Days of cover: <span className="text-fg">{rec.metrics.days_of_cover ?? '∞'}</span></div>
              <div>Lead time: <span className="text-fg">{rec.metrics.lead_time_days}d</span></div>
              {rec.metrics.on_order ? <div>On order: <span className="text-fg">{rec.metrics.on_order}</span></div> : null}
            </dl>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {Number(rec.potential_savings) > 0 && <Badge tone="green">Potential savings {formatMoney(rec.potential_savings, store.currency)}</Badge>}
            {rec.recommended_quantity > 0 && <Badge tone="blue">Order {rec.recommended_quantity} units</Badge>}
            {canWrite(store) && !compact && (
              <span className="ml-auto flex gap-2">
                {rec.recommended_quantity > 0 && (
                  <Button size="sm" loading={order.isPending} disabled={!rec.supplier} title={rec.supplier ? undefined : 'Assign a supplier to the product first'} onClick={() => order.mutate()}>
                    <ShoppingCart /> Create purchase order
                  </Button>
                )}
                <Button size="sm" variant="ghost" loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
                  <X /> Dismiss
                </Button>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function Insights() {
  const store = useStore()
  const qc = useQueryClient()
  const [kind, setKind] = useState('')
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ssk.insights(store.id), queryFn: () => smartstockApi.recommendations(store.id) })
  const regen = useMutation({
    mutationFn: () => smartstockApi.regenerate(store.id),
    onSuccess: (recs) => (qc.setQueryData(ssk.insights(store.id), recs), qc.invalidateQueries({ queryKey: ssk.dashboard(store.id) }), toast.success(`Analysis complete: ${recs.length} insights`)),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const list = data?.filter((r) => !kind || r.kind === kind) ?? []
  return (
    <div>
      <div className="mb-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        <p className="flex items-center gap-2 font-medium text-fg"><Sparkles className="size-4 text-brand-cyan" /> How insights are calculated</p>
        <p className="mt-1">
          SmartStock uses an explainable rule-based model (no external AI service): average daily sales over the last 30 days, days of cover vs. supplier lead time,
          a 14-day cover target plus minimum stock for reorder quantities, &gt;90 days of cover for overstock, and projected sell-through before the expiry date.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select aria-label="Filter insights" value={kind} onChange={(e) => setKind(e.target.value)} className="w-52">
          <option value="">All insights</option>
          <option value="stockout">Risk of stockout</option>
          <option value="reorder">Recommended purchase</option>
          <option value="overstock">Overstock</option>
          <option value="expiry">Expiry risk</option>
        </Select>
        {canWrite(store) && (
          <Button variant="outline" loading={regen.isPending} onClick={() => regen.mutate()} className="ml-auto">
            <RefreshCw /> Re-run analysis
          </Button>
        )}
      </div>
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? <LoadingState /> : list.length === 0 ? (
        <EmptyState icon={Sparkles} title="No open insights" description="Everything looks healthy. Re-run the analysis after recording sales or receiving stock." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">{list.map((r) => <InsightCard key={r.id} rec={r} />)}</div>
      )}
    </div>
  )
}
