import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, Globe, Info, Rocket } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/states'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { formatDate } from '@/lib/utils'
import { builderApi } from '@/services/api'

export function PublicationPanel({ projectId, canEdit, beforePublish }: { projectId: number; canEdit: boolean; beforePublish?: () => Promise<boolean> }) {
  const qc = useQueryClient()
  const [note, setNote] = useState('')
  const [confirmUnpublish, setConfirmUnpublish] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: qk.publications(projectId), queryFn: () => builderApi.publications(projectId) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.publications(projectId) })
    void qc.invalidateQueries({ queryKey: ['project', projectId] })
    void qc.invalidateQueries({ queryKey: ['projects'] })
  }
  const publish = useMutation({
    mutationFn: async () => {
      if (beforePublish && !(await beforePublish())) throw new Error('Save failed — fix the errors before publishing.')
      return builderApi.publish(projectId, note)
    },
    onSuccess: (site) => {
      refresh()
      setNote('')
      toast.success(`Published version ${site.version}`)
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const unpublish = useMutation({
    mutationFn: () => builderApi.unpublish(projectId),
    onSuccess: () => (refresh(), toast.success('Site unpublished')),
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (isLoading || !data) return <LoadingState />
  const { site, versions } = data
  const localUrl = site.slug ? `${window.location.origin}/sites/${site.slug}` : null
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Globe className="size-4" /> Status
          </span>
          {site.is_live ? <Badge tone="green">Live · v{site.version}</Badge> : <Badge>Not published</Badge>}
        </div>
        {site.is_live && localUrl && (
          <div className="mt-3 flex gap-2">
            <Input readOnly value={localUrl} aria-label="Published URL" className="h-9 text-xs" onFocus={(e) => e.target.select()} />
            <Button size="icon" variant="outline" aria-label="Copy URL" onClick={() => void navigator.clipboard?.writeText(localUrl).then(() => toast.success('URL copied'))}>
              <Copy />
            </Button>
            <Button size="icon" variant="outline" asChild>
              <a href={`/sites/${site.slug}`} target="_blank" rel="noreferrer" aria-label="Open published site">
                <ExternalLink />
              </a>
            </Button>
          </div>
        )}
        <p className="mt-3 flex gap-2 text-xs text-muted">
          <Info className="size-3.5 shrink-0" /> Sites are served by this WebMindClub instance at <code>/sites/&lt;slug&gt;</code>. No external hosting or custom domain is configured.
        </p>
      </div>
      {canEdit && (
        <div className="space-y-3">
          <Field label="Release note" htmlFor="pub-note" hint="Optional — shown in publication history.">
            <Input id="pub-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="e.g. New pricing page" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button variant="gradient" loading={publish.isPending} onClick={() => publish.mutate()}>
              <Rocket /> {site.is_live ? 'Publish new version' : 'Publish'}
            </Button>
            {site.is_live && (
              <Button variant="outline" onClick={() => setConfirmUnpublish(true)}>
                Unpublish
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">Publishing snapshots the saved theme and all pages marked “Include when publishing”.</p>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">Publication history</p>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">Nothing published yet.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
            {versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3 text-sm">
                <div>
                  <p className="font-medium">
                    {v.action === 'publish' ? `v${v.number} published` : 'Unpublished'} {v.note && <span className="font-normal text-muted">— {v.note}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(v.created_at, { dateStyle: 'medium', timeStyle: 'short' })} · {v.published_by?.display_name ?? 'Unknown'}
                    {v.action === 'publish' && ` · ${v.page_count} pages`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title="Unpublish site?"
        description="The public URL will stop working immediately. You can publish again at any time."
        confirmLabel="Unpublish"
        loading={unpublish.isPending}
        onConfirm={() => unpublish.mutateAsync().catch(() => undefined)}
      />
    </div>
  )
}

export function PublishDialog({ projectId, open, onOpenChange, canEdit, beforePublish }: { projectId: number; open: boolean; onOpenChange: (o: boolean) => void; canEdit: boolean; beforePublish: () => Promise<boolean> }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Publish site" description="Unsaved changes are saved automatically before publishing.">
        <PublicationPanel projectId={projectId} canEdit={canEdit} beforePublish={beforePublish} />
      </DialogContent>
    </Dialog>
  )
}
