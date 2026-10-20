import { zodResolver } from '@hookform/resolvers/zod'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownUp, Boxes, Download, MoreHorizontal, PackagePlus, Pencil, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Field, Input, Select } from '@/components/ui/input'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useDebounce } from '@/hooks/use-debounce'
import { applyServerErrors, errorMessage } from '@/lib/forms'
import { cn, formatDate, formatMoney } from '@/lib/utils'
import { smartstockApi } from '@/services/api'
import type { Product } from '@/types'
import { canWrite, ssk, useStore } from './context'

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter an amount like 4.99.')
const productSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(160),
  sku: z.string().trim().min(1, 'SKU is required.').max(40),
  category: z.string().trim().min(1, 'Category is required.').max(60),
  purchase_price: money,
  sale_price: money,
  stock: z.coerce.number<string>().int('Whole numbers only.').min(0, 'Cannot be negative.'),
  min_stock: z.coerce.number<string>().int('Whole numbers only.').min(0, 'Cannot be negative.'),
  expiry_date: z.string(),
  supplier: z.string(),
}).refine((v) => Number(v.sale_price) >= Number(v.purchase_price), { path: ['sale_price'], message: 'Sale price should not be lower than purchase price.' })
type ProductIn = z.input<typeof productSchema>
type ProductOut = z.output<typeof productSchema>

function ProductDialog({ product, open, onOpenChange }: { product?: Product | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const store = useStore()
  const qc = useQueryClient()
  const suppliers = useQuery({ queryKey: ssk.suppliers(store.id), queryFn: () => smartstockApi.suppliers(store.id), enabled: open })
  const categories = useQuery({ queryKey: ssk.categories(store.id), queryFn: () => smartstockApi.categories(store.id), enabled: open })
  const form = useForm<ProductIn, unknown, ProductOut>({ resolver: zodResolver(productSchema) })
  useEffect(() => {
    if (open)
      form.reset({
        name: product?.name ?? '', sku: product?.sku ?? '', category: product?.category ?? '',
        purchase_price: product?.purchase_price ?? '', sale_price: product?.sale_price ?? '',
        stock: String(product?.stock ?? 0), min_stock: String(product?.min_stock ?? 0),
        expiry_date: product?.expiry_date ?? '', supplier: product?.supplier ? String(product.supplier) : '',
      })
  }, [open, product, form])
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async (v) => {
    const payload: Record<string, unknown> = { ...v, store: store.id, expiry_date: v.expiry_date || null, supplier: v.supplier ? Number(v.supplier) : null }
    if (product) delete payload.stock
    try {
      if (product) await smartstockApi.updateProduct(product.id, payload)
      else await smartstockApi.createProduct(payload)
      await qc.invalidateQueries({ queryKey: ['smartstock', store.id] })
      toast.success(product ? 'Product updated' : 'Product added')
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(e, form.setError, ['name', 'sku', 'category', 'purchase_price', 'sale_price', 'stock', 'min_stock', 'expiry_date', 'supplier'])
    }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={product ? 'Edit product' : 'Add product'} className="max-w-xl">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Name" htmlFor="pr-name" error={errors.name?.message} className="sm:col-span-2">
            <Input id="pr-name" {...form.register('name')} />
          </Field>
          <Field label="SKU" htmlFor="pr-sku" error={errors.sku?.message}>
            <Input id="pr-sku" {...form.register('sku')} />
          </Field>
          <Field label="Category" htmlFor="pr-cat" error={errors.category?.message}>
            <Input id="pr-cat" list="pr-categories" {...form.register('category')} />
            <datalist id="pr-categories">{categories.data?.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label={`Purchase price (${store.currency})`} htmlFor="pr-buy" error={errors.purchase_price?.message}>
            <Input id="pr-buy" inputMode="decimal" {...form.register('purchase_price')} />
          </Field>
          <Field label={`Sale price (${store.currency})`} htmlFor="pr-sell" error={errors.sale_price?.message}>
            <Input id="pr-sell" inputMode="decimal" {...form.register('sale_price')} />
          </Field>
          <Field label="Stock" htmlFor="pr-stock" error={errors.stock?.message} hint={product ? 'Use “Adjust stock” to change quantities (audited).' : 'Opening balance.'}>
            <Input id="pr-stock" type="number" min={0} disabled={!!product} {...form.register('stock')} />
          </Field>
          <Field label="Minimum stock" htmlFor="pr-min" error={errors.min_stock?.message}>
            <Input id="pr-min" type="number" min={0} {...form.register('min_stock')} />
          </Field>
          <Field label="Expiry date" htmlFor="pr-exp" hint="Optional — for perishable goods.">
            <Input id="pr-exp" type="date" {...form.register('expiry_date')} />
          </Field>
          <Field label="Supplier" htmlFor="pr-sup" error={errors.supplier?.message}>
            <Select id="pr-sup" {...form.register('supplier')}>
              <option value="">No supplier</option>
              {suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{product ? 'Save' : 'Add product'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const adjustSchema = z.object({
  kind: z.enum(['sale', 'receipt', 'return', 'write_off', 'adjustment']),
  quantity: z.coerce.number<string>().int('Whole numbers only.').refine((n) => n !== 0, 'Quantity cannot be zero.'),
  reason: z.string().max(200),
})

function AdjustDialog({ product, onOpenChange }: { product: Product | null; onOpenChange: (o: boolean) => void }) {
  const store = useStore()
  const qc = useQueryClient()
  const form = useForm<z.input<typeof adjustSchema>, unknown, z.output<typeof adjustSchema>>({ resolver: zodResolver(adjustSchema) })
  useEffect(() => {
    if (product) form.reset({ kind: 'sale', quantity: '1', reason: '' })
  }, [product, form])
  const kind = form.watch('kind')
  const onSubmit = form.handleSubmit(async (v) => {
    if (!product) return
    if (v.kind !== 'adjustment' && v.quantity < 0) return form.setError('quantity', { message: 'Use a positive quantity for this movement.' })
    try {
      const p = await smartstockApi.adjust(product.id, v)
      await qc.invalidateQueries({ queryKey: ['smartstock', store.id] })
      toast.success(`Stock for ${p.name} is now ${p.stock}`)
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(e, form.setError, ['kind', 'quantity', 'reason'])
    }
  })
  return (
    <Dialog open={!!product} onOpenChange={onOpenChange}>
      <DialogContent title={`Adjust stock · ${product?.name ?? ''}`} description={`Current stock: ${product?.stock ?? 0}. Every change is recorded in the audit trail.`}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Movement type" htmlFor="adj-kind">
            <Select id="adj-kind" {...form.register('kind')}>
              <option value="sale">Sale (−)</option>
              <option value="receipt">Receipt (+)</option>
              <option value="return">Customer return (+)</option>
              <option value="write_off">Write-off (−)</option>
              <option value="adjustment">Manual adjustment (±)</option>
            </Select>
          </Field>
          <Field label="Quantity" htmlFor="adj-qty" error={form.formState.errors.quantity?.message} hint={kind === 'adjustment' ? 'Use a negative number to decrease stock.' : undefined}>
            <Input id="adj-qty" type="number" {...form.register('quantity')} />
          </Field>
          <Field label="Reason" htmlFor="adj-reason">
            <Input id="adj-reason" maxLength={200} placeholder="e.g. Stock count correction" {...form.register('reason')} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={form.formState.isSubmitting}>Apply</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const STATUS = { out: { label: 'Out of stock', tone: 'red' as const }, low: { label: 'Low', tone: 'amber' as const }, ok: { label: 'In stock', tone: 'green' as const } }
const COLUMNS: { key: string; label: string; sortable?: boolean; className?: string }[] = [
  { key: 'name', label: 'Product', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'purchase_price', label: 'Purchase', sortable: true, className: 'text-right' },
  { key: 'sale_price', label: 'Sale', sortable: true, className: 'text-right' },
  { key: 'stock', label: 'Stock', sortable: true, className: 'text-right' },
  { key: 'expiry_date', label: 'Expiry', sortable: true },
  { key: 'status', label: 'Status' },
]

export function Inventory() {
  const store = useStore()
  const qc = useQueryClient()
  const writable = canWrite(store)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [ordering, setOrdering] = useState('name')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<{ product?: Product } | null>(null)
  const [adjusting, setAdjusting] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const debounced = useDebounce(search)
  const q = { store: store.id, search: debounced, category, stock_status: status, ordering, page, page_size: 25 }
  const { data, isLoading, error, refetch, isFetching } = useQuery({ queryKey: ssk.products(store.id, q), queryFn: () => smartstockApi.products(q), placeholderData: keepPreviousData })
  const categories = useQuery({ queryKey: ssk.categories(store.id), queryFn: () => smartstockApi.categories(store.id) })
  const remove = useMutation({
    mutationFn: (id: number) => smartstockApi.deleteProduct(id),
    onSuccess: () => (qc.invalidateQueries({ queryKey: ['smartstock', store.id] }), toast.success('Product deleted')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const exportCsv = async () => {
    try {
      const blob = await smartstockApi.exportCsv({ store: store.id, search: debounced, category, stock_status: status, ordering })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `smartstock-inventory-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }
  const sortBy = (key: string) => {
    setOrdering(ordering === key ? `-${key}` : key)
    setPage(1)
  }
  const isExpiring = (p: Product) => p.expiry_date && (new Date(p.expiry_date).getTime() - Date.now()) / 86400000 <= 7
  const pages = data ? Math.max(1, Math.ceil(data.count / 25)) : 1

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={search} onChange={(e) => (setSearch(e.target.value), setPage(1))} placeholder="Search name, SKU or category" className="pl-9" aria-label="Search products" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Category" value={category} onChange={(e) => (setCategory(e.target.value), setPage(1))} className="w-40">
            <option value="">All categories</option>
            {categories.data?.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select aria-label="Stock status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} className="w-40">
            <option value="">Any stock level</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="ok">In stock</option>
          </Select>
          <Button variant="outline" onClick={() => void exportCsv()}>
            <Download /> CSV
          </Button>
          {writable && (
            <Button onClick={() => setEditing({})}>
              <Plus /> Add product
            </Button>
          )}
        </div>
      </div>
      {error ? <ErrorState error={error} onRetry={() => refetch()} /> : isLoading || !data ? <LoadingState /> : data.count === 0 ? (
        <EmptyState icon={Boxes} title={debounced || category || status ? 'No products match' : 'No products yet'} description="Add products to start tracking inventory." action={writable && <Button onClick={() => setEditing({})}><PackagePlus /> Add product</Button>} />
      ) : (
        <>
          <div className={cn('overflow-x-auto rounded-card border border-line bg-surface transition-opacity', isFetching && 'opacity-70')}>
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={cn('px-4 py-3 font-medium', c.className)} aria-sort={ordering === c.key ? 'ascending' : ordering === `-${c.key}` ? 'descending' : undefined}>
                      {c.sortable ? (
                        <button className="inline-flex items-center gap-1 uppercase hover:text-fg cursor-pointer" onClick={() => sortBy(c.key)}>
                          {c.label} <ArrowDownUp className={cn('size-3', ordering.replace('-', '') === c.key ? 'text-brand-blue' : 'opacity-40')} />
                        </button>
                      ) : c.label}
                    </th>
                  ))}
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {data.results.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0 hover:bg-hover/40">
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted">{p.sku}{p.supplier_name && ` · ${p.supplier_name}`}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.purchase_price, store.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(p.sale_price, store.currency)}
                      {p.margin_percent !== null && <p className="text-xs text-muted">{p.margin_percent}% margin</p>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className="font-medium">{p.stock}</span>
                      <p className="text-xs text-muted">min {p.min_stock}</p>
                    </td>
                    <td className={cn('px-4 py-3', isExpiring(p) ? 'text-red-500' : 'text-muted')}>{p.expiry_date ? formatDate(p.expiry_date) : '—'}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS[p.stock_status].tone}>{STATUS[p.stock_status].label}</Badge></td>
                    <td className="px-2">
                      {writable && (
                        <Dropdown>
                          <DropdownTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${p.name}`}><MoreHorizontal /></Button>
                          </DropdownTrigger>
                          <DropdownContent>
                            <DropdownItem onSelect={() => setAdjusting(p)}><SlidersHorizontal /> Adjust stock</DropdownItem>
                            <DropdownItem onSelect={() => setEditing({ product: p })}><Pencil /> Edit</DropdownItem>
                            {store.role === 'store_manager' && (
                              <>
                                <DropdownSeparator />
                                <DropdownItem destructive onSelect={() => setDeleting(p)}><Trash2 /> Delete</DropdownItem>
                              </>
                            )}
                          </DropdownContent>
                        </Dropdown>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.count} products</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span>Page {page} of {pages}</span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
      <ProductDialog product={editing?.product} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
      <AdjustDialog product={adjusting} onOpenChange={(o) => !o && setAdjusting(null)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="The product and its stock history will be permanently deleted."
        confirmLabel="Delete product"
        onConfirm={() => deleting && remove.mutateAsync(deleting.id).catch(() => undefined)}
      />
    </div>
  )
}
