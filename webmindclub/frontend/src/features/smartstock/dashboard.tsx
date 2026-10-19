import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Boxes, DollarSign, PiggyBank, ShoppingCart, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { formatMoney } from '@/lib/utils'
import { smartstockApi } from '@/services/api'
import { ssk, useStore } from './context'
import { InsightCard } from './insights'

const tooltipStyle = { background: 'var(--wm-elevated)', border: '1px solid var(--wm-line)', borderRadius: 12, fontSize: 12, color: 'var(--wm-fg)' }
const axis = { stroke: 'var(--wm-muted)', fontSize: 11, tickLine: false, axisLine: false }

export function Dashboard() {
  const store = useStore()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ssk.dashboard(store.id), queryFn: () => smartstockApi.dashboard(store.id) })
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />
  const money = (v: string | number) => formatMoney(v, store.currency)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {isLoading || !data ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
        ) : (
          <>
            <StatCard label="Inventory Value" value={money(data.inventory_value)} icon={DollarSign} hint={`Retail value ${money(data.retail_value)}`} />
            <StatCard label="Products" value={data.products} icon={Boxes} tone="cyan" />
            <StatCard label="Low Stock" value={data.low_stock} icon={AlertTriangle} tone="amber" hint={`${data.out_of_stock} out of stock`} />
            <StatCard label="Sales (30 days)" value={money(data.sales_30d)} icon={ShoppingCart} tone="green" hint={`${data.units_sold_30d} units sold`} />
            <StatCard label="Potential Savings" value={money(data.potential_savings)} icon={PiggyBank} tone="purple" hint="From open AI insights" />
            <StatCard label="AI Insights" value={data.open_insights} icon={Sparkles} tone="blue" hint="Open recommendations" />
          </>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Daily revenue · last 30 days</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.sales_series} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--wm-line)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
                  <YAxis {...axis} width={56} tickFormatter={(v: number) => money(v).replace(/\.\d+$/, '')} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [money(Number(v)), 'Revenue']} cursor={{ stroke: 'var(--wm-muted)', strokeDasharray: 4 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#rev)" activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--wm-surface)' }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory value by category</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {data && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.category_value} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid horizontal={false} stroke="var(--wm-line)" strokeDasharray="3 3" />
                  <XAxis type="number" {...axis} tickFormatter={(v: number) => money(v).replace(/\.\d+$/, '')} />
                  <YAxis type="category" dataKey="category" {...axis} width={78} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [money(Number(v)), 'Value']} cursor={{ fill: 'var(--wm-hover)' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand-cyan" /> Top AI insights
          </CardTitle>
          <Link to={`/smartstock/${store.id}/insights`} className="text-sm text-brand-blue hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {data?.top_insights.length ? data.top_insights.map((r) => <InsightCard key={r.id} rec={r} compact />) : <p className="text-sm text-muted">No open insights — inventory looks healthy.</p>}
        </CardContent>
      </Card>
    </div>
  )
}
