import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, FileText, History, Home, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/states'
import { qk } from '@/hooks/use-workspace'
import { applyServerErrors, errorMessage } from '@/lib/forms'
import { cn, slugify, timeAgo } from '@/lib/utils'
import { builderApi } from '@/services/api'
import type { Registry, WebsitePage } from '@/types'
import { createBlock } from '../block-ops'

const PAGE_STARTERS: Record<string, { title: string; types: string[] }> = {
  blank: { title: 'Custom page', types: [] },
  about: { title: 'About', types: ['heading', 'paragraph', 'stats', 'testimonials'] },
  products: { title: 'Products', types: ['heading', 'products'] },
  services: { title: 'Services', types: ['heading', 'features', 'pricing'] },
  contact: { title: 'Contact', types: ['contact', 'faq'] },
}

const pageSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(120),
  slug: z.string().trim().min(1, 'Slug is required.').max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.'),
  seo_title: z.string().max(70),
  seo_description: z.string().max(180),
  status: z.enum(['draft', 'published']),
  starter: z.string(),
})
type PageValues = z.infer<typeof pageSchema>

function PageDialog({ projectId, registry, page, open, onOpenChange, onSaved, nav }: {
  projectId: number
  registry: Registry
  page?: WebsitePage
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: (p: WebsitePage) => void
  nav: { brand: string } | null
}) {
  const form = useForm<PageValues>({ resolver: zodResolver(pageSchema) })
  const [slugTouched, setSlugTouched] = useState(false)
  useEffect(() => {
    if (open) {
      setSlugTouched(!!page)
      form.reset(page ? { title: page.title, slug: page.slug, seo_title: page.seo_title, seo_description: page.seo_description, status: page.status, starter: 'blank' } : { title: '', slug: '', seo_title: '', seo_description: '', status: 'published', starter: 'blank' })
    }
  }, [open, page, form])
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async ({ starter, ...v }) => {
    try {
      let saved: WebsitePage
      if (page) saved = await builderApi.updatePage(page.id, v)
      else {
        const blocks = PAGE_STARTERS[starter].types.map((t) => createBlock(registry, t))
        if (nav && starter !== 'blank') {
          blocks.unshift({ ...createBlock(registry, 'navbar'), props: { ...createBlock(registry, 'navbar').props, brand: nav.brand } })
          blocks.push({ ...createBlock(registry, 'footer'), props: { ...createBlock(registry, 'footer').props, brand: nav.brand } })
        }
        saved = await builderApi.createPage({ ...v, project: projectId, content: { blocks } })
      }
      toast.success(page ? 'Page settings saved' : `Page “${saved.title}” created`)
      onSaved(saved)
      onOpenChange(false)
    } catch (e) {
      applyServerErrors(e, form.setError, ['title', 'slug', 'seo_title', 'seo_description'])
    }
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={page ? 'Page settings' : 'New page'} description={page ? 'Title, URL and SEO settings.' : 'Add a page to this project.'}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {!page && (
            <Field label="Start from" htmlFor="starter">
              <Select
                id="starter"
                {...form.register('starter', {
                  onChange: (e) => {
                    const s = PAGE_STARTERS[e.target.value]
                    if (!form.getValues('title') || Object.values(PAGE_STARTERS).some((x) => x.title === form.getValues('title'))) {
                      form.setValue('title', s.title)
                      if (!slugTouched) form.setValue('slug', slugify(s.title))
                    }
                  },
                })}
              >
                <option value="blank">Blank / custom page</option>
                <option value="about">About</option>
                <option value="products">Products</option>
                <option value="services">Services</option>
                <option value="contact">Contact</option>
              </Select>
            </Field>
          )}
          <Field label="Title" htmlFor="pg-title" error={errors.title?.message}>
            <Input id="pg-title" {...form.register('title', { onChange: (e) => !slugTouched && form.setValue('slug', slugify(e.target.value)) })} />
          </Field>
          <Field label="Slug" htmlFor="pg-slug" error={errors.slug?.message} hint={page?.is_home ? 'This is the home page; it is served at the site root.' : 'Page URL: /slug'}>
            <Input id="pg-slug" {...form.register('slug', { onChange: () => setSlugTouched(true) })} />
          </Field>
          <Field label="SEO title" htmlFor="pg-seo" error={errors.seo_title?.message} hint="Up to 70 characters.">
            <Input id="pg-seo" maxLength={70} {...form.register('seo_title')} />
          </Field>
          <Field label="SEO description" htmlFor="pg-desc" error={errors.seo_description?.message} hint="Up to 180 characters.">
            <Textarea id="pg-desc" rows={2} maxLength={180} {...form.register('seo_description')} />
          </Field>
          <Field label="Publication status" htmlFor="pg-status" hint="Draft pages are excluded from the published site.">
            <Select id="pg-status" {...form.register('status')}>
              <option value="published">Include when publishing</option>
              <option value="draft">Draft (not published)</option>
            </Select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {page ? 'Save' : 'Create page'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function VersionsDialog({ page, open, onOpenChange, onRestored }: { page: WebsitePage; open: boolean; onOpenChange: (o: boolean) => void; onRestored: (p: WebsitePage) => void }) {
  const { data, isLoading } = useQuery({ queryKey: qk.versions(page.id), queryFn: () => builderApi.versions(page.id), enabled: open })
  const restore = useMutation({
    mutationFn: (v: number) => builderApi.restoreVersion(page.id, v),
    onSuccess: (p) => {
      toast.success('Version restored')
      onRestored(p)
      onOpenChange(false)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Version history · ${page.title}`} description="A version is saved every time the page design changes. Restoring creates a new version.">
        {isLoading ? (
          <LoadingState />
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto scrollbar-thin">
            {data?.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {v.note || 'Saved'} {i === 0 && <Badge tone="green">Current</Badge>}
                  </p>
                  <p className="text-xs text-muted">
                    {timeAgo(v.created_at)} · {v.created_by?.display_name ?? 'Unknown'} · {v.block_count} components
                  </p>
                </div>
                {i > 0 && (
                  <Button size="sm" variant="outline" loading={restore.isPending && restore.variables === v.id} onClick={() => restore.mutate(v.id)}>
                    Restore
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PagesPanel({ projectId, pages, currentId, registry, readOnly, onOpen, brand }: {
  projectId: number
  pages: WebsitePage[]
  currentId: number | null
  registry: Registry
  readOnly: boolean
  onOpen: (page: WebsitePage) => void
  brand: string
}) {
  const qc = useQueryClient()
  const [dialog, setDialog] = useState<{ page?: WebsitePage } | null>(null)
  const [history, setHistory] = useState<WebsitePage | null>(null)
  const [toDelete, setToDelete] = useState<WebsitePage | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: qk.pages(projectId) })
  const reorder = useMutation({
    mutationFn: (order: number[]) => builderApi.reorderPages(projectId, order),
    onSuccess: (data) => qc.setQueryData(qk.pages(projectId), data),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const setHome = useMutation({
    mutationFn: (id: number) => builderApi.updatePage(id, { is_home: true }),
    onSuccess: () => (refresh(), toast.success('Home page updated')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => builderApi.deletePage(id),
    onSuccess: async (_, id) => {
      await refresh()
      toast.success('Page deleted')
      if (id === currentId) {
        const next = pages.find((p) => p.id !== id)
        if (next) onOpen(next)
      }
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const move = (i: number, d: number) => {
    const ids = pages.map((p) => p.id)
    ;[ids[i], ids[i + d]] = [ids[i + d], ids[i]]
    reorder.mutate(ids)
  }

  return (
    <div className="p-3">
      <ul className="space-y-1">
        {pages.map((p, i) => (
          <li key={p.id} className={cn('group flex items-center gap-1 rounded-xl border px-2 py-1.5', p.id === currentId ? 'border-brand-blue bg-brand-blue/10' : 'border-transparent hover:bg-hover')}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm cursor-pointer" onClick={() => onOpen(p)}>
              {p.is_home ? <Home className="size-3.5 shrink-0 text-brand-blue" /> : <FileText className="size-3.5 shrink-0 text-muted" />}
              <span className="truncate font-medium">{p.title}</span>
              {p.status === 'draft' && <Badge className="ml-auto">Draft</Badge>}
            </button>
            <Dropdown>
              <DropdownTrigger asChild>
                <button type="button" className="rounded p-1 text-muted hover:bg-hover hover:text-fg cursor-pointer" aria-label={`Page actions for ${p.title}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownTrigger>
              <DropdownContent>
                {!readOnly && (
                  <DropdownItem onSelect={() => setDialog({ page: p })}>
                    <Settings2 /> Settings & SEO
                  </DropdownItem>
                )}
                <DropdownItem onSelect={() => setHistory(p)}>
                  <History /> Version history
                </DropdownItem>
                {!readOnly && (
                  <>
                    {!p.is_home && (
                      <DropdownItem onSelect={() => setHome.mutate(p.id)}>
                        <Home /> Set as home page
                      </DropdownItem>
                    )}
                    <DropdownItem disabled={i === 0} onSelect={() => move(i, -1)}>
                      <ChevronUp /> Move up
                    </DropdownItem>
                    <DropdownItem disabled={i === pages.length - 1} onSelect={() => move(i, 1)}>
                      <ChevronDown /> Move down
                    </DropdownItem>
                    <DropdownSeparator />
                    <DropdownItem destructive disabled={pages.length <= 1} onSelect={() => setToDelete(p)}>
                      <Trash2 /> Delete page
                    </DropdownItem>
                  </>
                )}
              </DropdownContent>
            </Dropdown>
          </li>
        ))}
      </ul>
      {!readOnly && (
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setDialog({})}>
          <Plus /> Add page
        </Button>
      )}
      <PageDialog
        projectId={projectId}
        registry={registry}
        page={dialog?.page}
        open={!!dialog}
        onOpenChange={(o) => !o && setDialog(null)}
        nav={{ brand }}
        onSaved={async (p) => {
          await refresh()
          if (!dialog?.page) onOpen(p)
        }}
      />
      {history && (
        <VersionsDialog
          page={history}
          open={!!history}
          onOpenChange={(o) => !o && setHistory(null)}
          onRestored={async (p) => {
            await refresh()
            onOpen(p)
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete page “${toDelete?.title}”?`}
        description="The page and its version history will be deleted. Published versions are kept until you republish."
        confirmLabel="Delete page"
        onConfirm={() => toDelete && remove.mutateAsync(toDelete.id).catch(() => undefined)}
      />
    </div>
  )
}
