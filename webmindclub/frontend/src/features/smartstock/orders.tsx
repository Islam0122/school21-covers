import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, ClipboardList, Plus, Send, Trash2, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { errorMessage } from '@/lib/forms'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { smartstockApi } from '@/services/api'
import type { PurchaseOrder } from '@/types'
import { canWrite, ssk, useStore } from './context'

const TONE = { draft: 'neutral', ordered: 'blue', received: 'green', cancelled: 'red' } as const
type Line = { product: string; quantity: string; unit_price: string }

function OrderDialog({ order, open, onOpenChange }: { order?: PurchaseOrder | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useStore()
  const qc = useQueryClient()
  const suppliers = useQuery({ queryKey: ssk.suppliers(store.id), queryFn: () => smartstockApi.suppliers(store.id), enabled: open })
  const products = useQuery({ queryKey: ssk.products(store.id, { all: true }), queryFn: () => smartstockApi.products({ store: store.id, page_size: 200 }), enabled: open })
  const [supplier, setSupplier] = useState('')
  const [expected, setExpected] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    setSupplier(order ? String(order.supplier) : '')
    setExpected(order?.expected_delivery ?? '')
    setNotes(order?.notes ?? '')
    setLines(order ? order.items.map((i) => ({ product: String(i.product), quantity: String(i.quantity), unit_price: i.unit_price })) : [{ product: '', quantity: '1', unit_price: '' }])
    setError(null)
  }, [open, order])
  const productList = products.data?.results ?? []
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0)
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const submit = async () => {
    if (!supplier) return setError('Choose a supplier.')
    if (!lines.length) return setError('Add at least one product.')
    for (const l of lines) {
      if (!l.product) return setError('Choose a product on every line.')
      if (!Number.isInteger(Number(l.quantity)) || Number(l.quantity) < 1) return setError('Quantities must be whole numbers of at least 1.')
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(l.unit_price)) return setError('Enter a unit price like 2.49 on every line.')
    }
    if (new Set(lines.map((l) => l.product)).size !== lines.length) return setError('Each product can appear only once.')
    const payload = { store: store.id, supplier: Number(supplier), expected_delivery: expected || null, notes, items: lines.map((l) => ({ product: Number(l.product), quantity: Number(l.quantity), unit_price: l.unit_price })) }
    setSaving(true)
    try {
      if (order) await smartstockApi.updateOrder(order.id, payload)
      else await smartstockApi.createOrder(payload)
      await qc.invalidateQueries({ queryKey: ['smartstock', store.id] })
      toast.success(order ? 'Order updated' : 'Draft order created')
      onOpenChange(false)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={order ? `Edit PO-${order.id}` : 'New purchase order'} className="max-w-2xl">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier" htmlFor="po-sup">
              <Select id="po-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">Select supplier…</option>
                {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.lead_time_days}d lead time)</option>)}
              </Select>
            </Field>
            <Field label="Expected delivery" htmlFor="po-exp">
              <Input id="po-exp" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Products</p>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_100px_auto] gap-2">
                <Select aria-label="Product" value={l.product} onChange={(e) => {
                  const p = productList.find((x) => x.id === Number(e.target.value))
                  setLine(i, { product: e.target.value, unit_price: l.unit_price || p?.purchase_price || '' })
                }}>
                  <option value="">Product…</option>
                  {productList.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku}) · stock {p.stock}</option>)}
                </Select>
                <Input aria-label="Quantity" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                <Input aria-label="Unit price" inputMode="decimal" placeholder="Price" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} />
                <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><X /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setLines([...lines, { product: '', quantity: '1', unit_price: '' }])}><Plus /> Add line</Button>
          </div>
          <Field label="Notes" htmlFor="po-notes">
            <Input id="po-notes" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <p className="text-right text-sm">Total: <strong>{formatMoney(total, store.currency)}</strong></p>
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void submit()}>{order ? 'Save order' : 'Create draft'}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Orders() {
  const store = useStore()
  const qc = useQueryClient()
  const writable = canWrite(store)
  const [status, setStatus] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [dialog, setDialog] = useState<{ order?: PurchaseOrder } | null>(null)
  const [confirm, setConfirm] = useState<{ order: PurchaseOrder; action: 'receive' | 'cancel' | 'delete' } | null>(null)
  const q = { store: store.id, status }
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ssk.orders(store.id, q), queryFn: () => smartstockApi.orders(q) })
  const act = useMutation({
    mutationFn: ({ order, action }: { order: PurchaseOrder; action: 'place' | 'receive' | 'cancel' | 'delete' }): Promise<unknown> =>
      action === 'delete' ? smartstockApi.deleteOrder(order.id) : smartstockApi.orderAction(order.id, action),
    onSuccess: (_, { action, order }) => {
      void qc.invalidateQueries({ queryKey: ['smartstock', store.id] })
      toast.success({ place: `PO-${order.id} placed with supplier`, receive: `PO-${order.id} received — stock updated`, cancel: `PO-${order.id} cancelled`, delete: 'Draft deleted' }[action])
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        {writable && <Button className="ml-auto" onClick={() => setDialog({})}><Plus /> New purchase order</Button>}
      </div>
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <LoadingState /> : data.results.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No purchase orders" description="Create an order manually or from an AI insight." action={writable && <Button onClick={() => setDialog({})}><Plus /> New purchase order</Button>} />
      ) : (
        <ul className="space-y-2">
          {data.results.map((o) => (
            <li key={o.id} className="rounded-card border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-3 p-4">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer" onClick={() => setExpanded(expanded === o.id ? null : o.id)} aria-expanded={expanded === o.id}>
                  <ChevronDown className={cn('size-4 text-muted transition-transform', expanded === o.id && 'rotate-180')} />
                  <div className="min-w-0">
                    <p className="font-medium">PO-{o.id} · {o.supplier_name}</p>
                    <p className="text-xs text-muted">{o.items.length} products · expected {formatDate(o.expected_delivery)} · created {formatDate(o.created_at)}</p>
                  </div>
                </button>
                <span className="font-semibold tabular-nums">{formatMoney(o.total, store.currency)}</span>
                <Badge tone={TONE[o.status]}>{o.status_label}</Badge>
                {writable && (
                  <div className="flex gap-1">
                    {o.status === 'draft' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setDialog({ order: o })}>Edit</Button>
                        <Button size="sm" onClick={() => act.mutate({ order: o, action: 'place' })}><Send /> Place</Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Delete draft" onClick={() => setConfirm({ order: o, action: 'delete' })}><Trash2 /></Button>
                      </>
                    )}
                    {o.status === 'ordered' && (
                      <Button size="sm" variant="gradient" onClick={() => setConfirm({ order: o, action: 'receive' })}><CheckCircle2 /> Confirm receipt</Button>
                    )}
                    {(o.status === 'draft' || o.status === 'ordered') && (
                      <Button size="icon-sm" variant="ghost" aria-label="Cancel order" onClick={() => setConfirm({ order: o, action: 'cancel' })}><XCircle /></Button>
                    )}
                  </div>
                )}
              </div>
              {expanded === o.id && (
                <div className="border-t border-line p-4">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted"><tr><th className="pb-2 font-medium">Product</th><th className="pb-2 text-right font-medium">Qty</th><th className="pb-2 text-right font-medium">Unit price</th><th className="pb-2 text-right font-medium">Line total</th></tr></thead>
                    <tbody>
                      {o.items.map((i) => (
                        <tr key={i.id} className="border-t border-line">
                          <td className="py-2">{i.product_name} <span className="text-xs text-muted">{i.sku}</span></td>
                          <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(i.unit_price, store.currency)}</td>
                          <td className="py-2 text-right tabular-nums">{formatMoney(i.quantity * Number(i.unit_price), store.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {o.notes && <p className="mt-3 text-xs text-muted">Notes: {o.notes}</p>}
                  {o.received_at && <p className="mt-1 text-xs text-muted">Received {formatDate(o.received_at, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <OrderDialog order={dialog?.order} open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} />
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.action === 'receive' ? `Confirm receipt of PO-${confirm.order.id}?` : confirm?.action === 'cancel' ? `Cancel PO-${confirm?.order.id}?` : 'Delete draft order?'}
        description={confirm?.action === 'receive' ? 'Stock for every product on this order will be increased and recorded as a purchase receipt. This cannot be undone.' : confirm?.action === 'cancel' ? 'The order will be marked as cancelled. Stock is not changed.' : 'The draft will be permanently deleted.'}
        confirmLabel={confirm?.action === 'receive' ? 'Receive & update stock' : confirm?.action === 'cancel' ? 'Cancel order' : 'Delete'}
        destructive={confirm?.action !== 'receive'}
        onConfirm={() => confirm && act.mutateAsync(confirm).catch(() => undefined)}
      />
    </div>
  )
}
