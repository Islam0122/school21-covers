import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, ImagePlus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { builderApi } from '@/services/api'
import { useEditor } from '@/stores/editor'
import type { Asset, Registry } from '@/types'

export function AssetsPanel({ projectId, assets, registry, readOnly }: { projectId: number; assets: Asset[]; registry: Registry; readOnly: boolean }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [toDelete, setToDelete] = useState<Asset | null>(null)
  const { blocks, selectedId, patch } = useEditor()
  const selected = blocks.find((b) => b.id === selectedId)
  const imageField = selected && Object.entries(registry.components.find((c) => c.type === selected.type)?.props ?? {}).find(([, f]) => f.type === 'image')?.[0]

  const upload = useMutation({
    mutationFn: (file: File) => builderApi.uploadAsset(projectId, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.assets(projectId) })
      toast.success('Image uploaded')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: number) => builderApi.deleteAsset(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.assets(projectId) })
      toast.success('Asset deleted')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  return (
    <div className="p-4">
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line px-3 py-5 text-sm text-muted hover:bg-hover hover:text-fg disabled:opacity-50 cursor-pointer"
          >
            <ImagePlus className="size-5" />
            {upload.isPending ? 'Uploading…' : 'Upload image'}
            <span className="text-[11px]">PNG, JPEG, WebP, GIF · max 5 MB</span>
          </button>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              if (f.size > 5 * 1024 * 1024) return toast.error('Images must be smaller than 5 MB.')
              upload.mutate(f)
            }}
          />
        </>
      )}
      {imageField && !readOnly && <p className="mt-3 text-xs text-muted">Click an image to use it in the selected component.</p>}
      {assets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted">No assets uploaded yet.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <li key={a.id} className="group relative overflow-hidden rounded-xl border border-line">
              <button
                type="button"
                className="block w-full cursor-pointer"
                title={a.original_name}
                onClick={() => {
                  if (imageField && selected && !readOnly) {
                    patch(selected.id, { props: { [imageField]: a.url } })
                    toast.success('Image applied')
                  } else {
                    void navigator.clipboard?.writeText(a.url).then(() => toast.success('Image URL copied'))
                  }
                }}
              >
                <img src={a.url} alt={a.original_name} className="aspect-square w-full object-cover" />
              </button>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <span className="truncate">{a.width}×{a.height}</span>
                <span className="flex gap-1">
                  <button type="button" aria-label="Copy URL" className="cursor-pointer" onClick={() => void navigator.clipboard?.writeText(a.url).then(() => toast.success('Image URL copied'))}>
                    <Copy className="size-3" />
                  </button>
                  {!readOnly && (
                    <button type="button" aria-label={`Delete ${a.original_name}`} className="cursor-pointer" onClick={() => setToDelete(a)}>
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Delete asset?"
        description="Components that use this image will show a placeholder after you republish."
        confirmLabel="Delete"
        onConfirm={() => toDelete && remove.mutateAsync(toDelete.id).catch(() => undefined)}
      />
    </div>
  )
}
