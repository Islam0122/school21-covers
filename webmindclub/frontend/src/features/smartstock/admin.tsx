import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { History, Pencil, Plus, Trash2, Truck, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { cn, formatDate } from '@/lib/utils'
import { projectApi, smartstockApi, workspaceApi } from '@/services/api'
import type { Supplier } from '@/types'
import { canWrite, ssk, STORE_ROLE_LABELS, useStore } from './context'

function SupplierDialog({ supplier, open, onOpenChange }: { supplier?: Supplier; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useStore()
  const qc = useQueryClient()
  const [v, setV] = useState({ name: '', contact_email: '', phone: '', lead_time_days: '5' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (open) {
      setV({ name: supplier?.name ?? '', contact_email: supplier?.contact_email ?? '', phone: supplier?.phone ?? '', lead_time_days: String(supplier?.lead_time_days ?? 5) })
      setErrors({})
    }
  }, [open, supplier])
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!v.name.trim()) errs.name = 'Name is required.'
    if (v.contact_email && !/^\S+@\S+\.\S+$/.test(v.contact_email)) errs.contact_email = 'Enter a valid email.'
    if (!/^\d+$/.test(v.lead_time_days) || Number(v.lead_time_days) > 365) errs.lead_time_days = 'Whole number of days (0–365).'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const payload = { ...v, store: store.id, lead_time_days: Number(v.lead_time_days) }
      if (supplier) await smartstockApi.updateSupplier(supplier.id, payload)
      else await smartstockApi.createSupplier(payload)
      await qc.invalidateQueries({ queryKey: ssk.suppliers(store.id) })
      toast.success(supplier ? 'Supplier updated' : 'Supplier added')
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={supplier ? 'Edit supplier' : 'Add supplier'}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Name" htmlFor="sup-name" error={errors.name}><Input id="sup-name" value={v.name} maxLength={120} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Contact email" htmlFor="sup-email" error={errors.contact_email}><Input id="sup-email" type="email" value={v.contact_email} onChange={(e) => setV({ ...v, contact_email: e.target.value })} /></Field>
          <Field label="Phone" htmlFor="sup-phone"><Input id="sup-phone" value={v.phone} maxLength={40} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Lead time (days)" htmlFor="sup-lead" error={errors.lead_time_days} hint="Used by AI insights to time reorders."><Input id="sup-lead" type="number" min={0} value={v.lead_time_days} onChange={(e) => setV({ ...v, lead_time_days: e.target.value })} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{supplier ? 'Save' : 'Add supplier'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Suppliers() {
  const store = useStore()
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ supplier?: Supplier } | null>(null)
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ssk.suppliers(store.id), queryFn: () => smartstockApi.suppliers(store.id) })
  const remove = useMutation({
    mutationFn: (id: number) => smartstockApi.deleteSupplier(id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ssk.suppliers(store.id) }), toast.success('Supplier deleted')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div>
      {canWrite(store) && <div className="mb-4 flex justify-end"><Button onClick={() => setDialog({})}><Plus /> Add supplier</Button></div>}
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading ? <LoadingState /> : !data?.length ? (
        <EmptyState icon={Truck} title="No suppliers" description="Add suppliers to create purchase orders." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-1 text-xs text-muted">{s.contact_email || 'No email'} · {s.phone || 'No phone'}</p>
                  <Badge tone="cyan" className="mt-3">Lead time {s.lead_time_days} days</Badge>
                </div>
                {canWrite(store) && (
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => setDialog({ supplier: s })}><Pencil /></Button>
                    {store.role === 'store_manager' && <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`} onClick={() => setDeleting(s)}><Trash2 /></Button>}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      <SupplierDialog supplier={dialog?.supplier} open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} />
      <ConfirmDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)} title={`Delete ${deleting?.name}?`} description="Suppliers with purchase orders cannot be deleted." confirmLabel="Delete" onConfirm={() => deleting && remove.mutateAsync(deleting.id).catch(() => undefined)} />
    </div>
  )
}

export function Movements() {
  const store = useStore()
  const [page, setPage] = useState(1)
  const [kind, setKind] = useState('')
  const q = { store: store.id, page, kind }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ssk.movements(store.id, q), queryFn: () => smartstockApi.movements(q) })
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Select aria-label="Movement type" value={kind} onChange={(e) => (setKind(e.target.value), setPage(1))} className="w-48">
          <option value="">All movements</option>
          <option value="sale">Sales</option>
          <option value="receipt">Purchase receipts</option>
          <option value="adjustment">Adjustments</option>
          <option value="write_off">Write-offs</option>
          <option value="return">Returns</option>
          <option value="initial">Initial stock</option>
        </Select>
        <p className="text-xs text-muted">Append-only audit trail of every stock change.</p>
      </div>
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <LoadingState /> : data.results.length === 0 ? (
        <EmptyState icon={History} title="No stock movements" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 text-right font-medium">Change</th><th className="px-4 py-3 text-right font-medium">Stock after</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">By</th></tr>
              </thead>
              <tbody>
                {data.results.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 text-muted">{formatDate(m.created_at, { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td className="px-4 py-2.5">{m.product_name} <span className="text-xs text-muted">{m.sku}</span></td>
                    <td className="px-4 py-2.5">{m.kind_label}</td>
                    <td className={cn('px-4 py-2.5 text-right font-medium tabular-nums', m.quantity > 0 ? 'text-emerald-500' : 'text-red-500')}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{m.stock_after}</td>
                    <td className="px-4 py-2.5 text-muted">{m.reason}{m.reference && ` (${m.reference})`}</td>
                    <td className="px-4 py-2.5 text-muted">{m.created_by?.display_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.count} movements</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Staff() {
  const store = useStore()
  const qc = useQueryClient()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('analyst')
  const project = useQuery({ queryKey: qk.project(store.project), queryFn: () => projectApi.get(store.project) })
  const staff = useQuery({ queryKey: ssk.staff(store.id), queryFn: () => smartstockApi.staff(store.id) })
  const canAdmin = store.role === 'store_manager' || !!project.data?.permissions.manage
  const members = useQuery({ queryKey: qk.members(project.data?.workspace ?? 0), queryFn: () => workspaceApi.members(project.data!.workspace), enabled: !!project.data && canAdmin })
  const set = useMutation({
    mutationFn: ({ uid, r }: { uid: number; r: string }) => smartstockApi.setStaff(store.id, uid, r),
    onSuccess: (d) => (qc.setQueryData(ssk.staff(store.id), d), setUserId(''), toast.success('Store role saved')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => smartstockApi.removeStaff(store.id, id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ssk.staff(store.id) }), toast.success('Store role removed')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const assigned = new Set(staff.data?.map((s) => s.user.id))
  return (
    <Card className="max-w-3xl">
      <CardHeader><CardTitle>Store staff & roles</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted">SmartStock roles are separate from WebMindClub workspace roles. A workspace admin without a store role cannot see store data.</p>
        {canAdmin && (
          <form className="mb-5 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => (e.preventDefault(), userId && set.mutate({ uid: Number(userId), r: role }))}>
            <Select aria-label="Member" value={userId} onChange={(e) => setUserId(e.target.value)} className="flex-1">
              <option value="">Add a workspace member…</option>
              {members.data?.filter((m) => !assigned.has(m.user.id)).map((m) => <option key={m.user.id} value={m.user.id}>{m.user.display_name}</option>)}
            </Select>
            <Select aria-label="Store role" value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-48">
              {Object.entries(STORE_ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            <Button type="submit" disabled={!userId} loading={set.isPending}><UserPlus /> Add</Button>
          </form>
        )}
        {staff.isLoading ? <LoadingState className="py-6" /> : (
          <ul className="divide-y divide-line">
            {staff.data?.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <Avatar name={s.user.display_name} src={s.user.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.user.display_name}</p>
                  <p className="truncate text-xs text-muted">{s.user.email}</p>
                </div>
                {canAdmin ? (
                  <>
                    <Select aria-label={`Role of ${s.user.display_name}`} value={s.role} onChange={(e) => set.mutate({ uid: s.user.id, r: e.target.value })} className="h-8 w-44 text-xs">
                      {Object.entries(STORE_ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </Select>
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${s.user.display_name}`} onClick={() => remove.mutate(s.id)}><Trash2 /></Button>
                  </>
                ) : <Badge>{s.role_label}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">Since {formatDate(store.created_at)}</p>
      </CardContent>
    </Card>
  )
}
