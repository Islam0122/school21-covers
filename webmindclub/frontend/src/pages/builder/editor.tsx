import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Boxes, Eye, FileText, ImageIcon, Layers, LayoutGrid, Loader2, Monitor, PanelLeft, PanelRight, Redo2, Rocket,
  Save, Smartphone, Tablet, Undo2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useBlocker, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { validateBlocks } from '@/features/builder/block-ops'
import { Canvas } from '@/features/builder/canvas'
import { AssetsPanel } from '@/features/builder/panels/assets-panel'
import { ComponentsPanel, SectionsPanel } from '@/features/builder/panels/components-panel'
import { LayersPanel } from '@/features/builder/panels/layers-panel'
import { PagesPanel } from '@/features/builder/panels/pages-panel'
import { PropertiesPanel } from '@/features/builder/panels/properties-panel'
import { PublishDialog } from '@/features/builder/publish-dialog'
import { qk } from '@/hooks/use-workspace'
import { errorMessage } from '@/lib/forms'
import { cn } from '@/lib/utils'
import { builderApi, projectApi } from '@/services/api'
import { useEditor } from '@/stores/editor'
import type { Device, WebsitePage } from '@/types'

const LEFT_TABS = [
  { key: 'pages', label: 'Pages', icon: FileText },
  { key: 'components', label: 'Components', icon: Boxes },
  { key: 'sections', label: 'Sections', icon: LayoutGrid },
  { key: 'layers', label: 'Layers', icon: Layers },
  { key: 'assets', label: 'Assets', icon: ImageIcon },
] as const
type LeftTab = (typeof LEFT_TABS)[number]['key']

const DEVICES: { key: Device; icon: typeof Monitor }[] = [
  { key: 'desktop', icon: Monitor },
  { key: 'tablet', icon: Tablet },
  { key: 'mobile', icon: Smartphone },
]

export default function EditorPage() {
  const { projectId: pid = '' } = useParams()
  const projectId = Number(pid)
  const [params, setParams] = useSearchParams()
  const qc = useQueryClient()
  const editor = useEditor()
  const [leftTab, setLeftTab] = useState<LeftTab>('components')
  const [showLeft, setShowLeft] = useState(true)
  const [showRight, setShowRight] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const loadedTheme = useRef(false)

  const project = useQuery({ queryKey: qk.project(projectId), queryFn: () => projectApi.get(projectId) })
  const registry = useQuery({ queryKey: qk.registry, queryFn: builderApi.registry, staleTime: Infinity })
  const pages = useQuery({ queryKey: qk.pages(projectId), queryFn: () => builderApi.pages(projectId) })
  const theme = useQuery({ queryKey: qk.theme(projectId), queryFn: () => builderApi.theme(projectId) })
  const assets = useQuery({ queryKey: qk.assets(projectId), queryFn: () => builderApi.assets(projectId) })
  const readOnly = project.data ? !project.data.permissions.edit : true
  const currentPage = pages.data?.find((p) => p.id === editor.pageId)

  // Initial load: theme + page from ?page= (or the home page).
  useEffect(() => {
    if (theme.data && !loadedTheme.current) {
      loadedTheme.current = true
      useEditor.getState().loadTheme(theme.data.preset, theme.data.tokens)
    }
  }, [theme.data])
  const wantedPage = Number(params.get('page'))
  useEffect(() => {
    if (!pages.data?.length) return
    const { pageId, loadPage } = useEditor.getState()
    if (pageId && pages.data.some((p) => p.id === pageId) && (!wantedPage || wantedPage === pageId)) return
    const page = pages.data.find((p) => p.id === wantedPage) ?? pages.data.find((p) => p.is_home) ?? pages.data[0]
    loadPage(page.id, page.content.blocks ?? [])
  }, [pages.data, wantedPage])
  useEffect(() => () => useEditor.setState({ pageId: null, theme: null, blocks: [] }), [])
  useEffect(() => {
    loadedTheme.current = false
  }, [projectId])

  const save = useCallback(async (): Promise<boolean> => {
    const s = useEditor.getState()
    if (readOnly || (!s.dirty && !s.themeDirty)) return true
    if (registry.data) {
      const problem = validateBlocks(s.blocks, registry.data)
      if (problem) {
        toast.error(`Can’t save: ${problem}`)
        return false
      }
    }
    setSaving(true)
    try {
      if (s.dirty && s.pageId) {
        const saved = await builderApi.savePageContent(s.pageId, { blocks: s.blocks })
        qc.setQueryData<WebsitePage[]>(qk.pages(projectId), (old) => old?.map((p) => (p.id === saved.id ? saved : p)))
        useEditor.getState().markSaved('page')
      }
      if (s.themeDirty && s.theme) {
        const t = await builderApi.saveTheme(projectId, { preset: s.preset, tokens: s.theme })
        qc.setQueryData(qk.theme(projectId), t)
        useEditor.getState().markSaved('theme')
      }
      void qc.invalidateQueries({ queryKey: ['preview', projectId] })
      void qc.invalidateQueries({ queryKey: qk.versions(s.pageId ?? 0) })
      toast.success('All changes saved')
      return true
    } catch (e) {
      toast.error(errorMessage(e))
      return false
    } finally {
      setSaving(false)
    }
  }, [readOnly, registry.data, qc, projectId])

  const openPage = async (page: WebsitePage) => {
    const s = useEditor.getState()
    if (page.id !== s.pageId && s.dirty && !(await save())) return
    editor.loadPage(page.id, page.content.blocks ?? [])
    setParams({ page: String(page.id) }, { replace: true })
  }

  const preview = async () => {
    const win = window.open('about:blank', '_blank')
    const ok = await save()
    if (!ok) return win?.close()
    const url = `/preview/${projectId}${currentPage && !currentPage.is_home ? `/${currentPage.slug}` : ''}`
    if (win) win.location.href = url
    else window.location.href = url
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      } else if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        if (e.shiftKey) useEditor.getState().redo()
        else useEditor.getState().undo()
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault()
        useEditor.getState().redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !typing && !readOnly) {
        const id = useEditor.getState().selectedId
        if (id) {
          e.preventDefault()
          useEditor.getState().remove(id)
        }
      } else if (e.key === 'Escape' && !typing) useEditor.getState().select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, readOnly])

  // Unsaved-changes protection
  const hasChanges = editor.dirty || editor.themeDirty
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty || useEditor.getState().themeDirty) e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])
  const blocker = useBlocker(({ currentLocation, nextLocation }) => hasChanges && currentLocation.pathname !== nextLocation.pathname)

  const error = project.error || registry.error || pages.error || theme.error
  if (error) return <ErrorState className="m-8" error={error} onRetry={() => (project.refetch(), pages.refetch(), theme.refetch(), registry.refetch())} />
  if (!project.data || !registry.data || !pages.data || !editor.theme || !editor.pageId) return <LoadingState className="h-screen" label="Opening the builder…" />

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <Button asChild variant="ghost" size="icon-sm" aria-label="Back to project">
          <Link to={`/app/projects/${projectId}`}>
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{project.data.name}</p>
          <p className="truncate text-xs text-muted">
            {currentPage?.title}
            {hasChanges ? ' · Unsaved changes' : ' · Saved'}
          </p>
        </div>
        {readOnly && <Badge tone="amber">Read-only</Badge>}
        <div className="mx-2 hidden h-6 w-px bg-line md:block" />
        <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" aria-label="Toggle left panel" aria-pressed={showLeft} onClick={() => setShowLeft(!showLeft)}>
          <PanelLeft />
        </Button>
        <div className="flex-1" />
        <div className="flex items-center rounded-xl border border-line p-0.5" role="group" aria-label="Viewport">
          {DEVICES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-label={`${key} preview`}
              aria-pressed={editor.device === key}
              onClick={() => editor.setDevice(key)}
              className={cn('rounded-lg p-1.5 cursor-pointer', editor.device === key ? 'bg-elevated text-fg shadow' : 'text-muted hover:text-fg')}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {!readOnly && (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!editor.past.length} onClick={editor.undo}>
              <Undo2 />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!editor.future.length} onClick={editor.redo}>
              <Redo2 />
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" onClick={() => void preview()}>
          <Eye /> <span className="hidden sm:inline">Preview</span>
        </Button>
        {!readOnly && (
          <>
            <Button variant="secondary" size="sm" onClick={() => void save()} disabled={!hasChanges || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Save />} <span className="hidden sm:inline">Save</span>
            </Button>
            <Button variant="gradient" size="sm" onClick={() => setPublishOpen(true)}>
              <Rocket /> <span className="hidden sm:inline">Publish</span>
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex" aria-label="Toggle right panel" aria-pressed={showRight} onClick={() => setShowRight(!showRight)}>
          <PanelRight />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {showLeft && (
          <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface md:flex" aria-label="Builder tools">
            <nav className="grid grid-cols-5 border-b border-line" role="tablist">
              {LEFT_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={leftTab === key}
                  title={label}
                  onClick={() => setLeftTab(key)}
                  className={cn('flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium cursor-pointer', leftTab === key ? 'text-brand-blue shadow-[inset_0_-2px_0_#2563eb]' : 'text-muted hover:text-fg')}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {leftTab === 'pages' && (
                <PagesPanel projectId={projectId} pages={pages.data} currentId={editor.pageId} registry={registry.data} readOnly={readOnly} onOpen={(p) => void openPage(p)} brand={project.data.name} />
              )}
              {leftTab === 'components' && <ComponentsPanel registry={registry.data} readOnly={readOnly} />}
              {leftTab === 'sections' && <SectionsPanel registry={registry.data} readOnly={readOnly} />}
              {leftTab === 'layers' && <LayersPanel registry={registry.data} readOnly={readOnly} />}
              {leftTab === 'assets' && <AssetsPanel projectId={projectId} assets={assets.data ?? []} registry={registry.data} readOnly={readOnly} />}
            </div>
          </aside>
        )}

        <Canvas registry={registry.data} readOnly={readOnly} onAddClick={() => (setShowLeft(true), setLeftTab('components'))} />

        {showRight && (
          <aside className="hidden w-80 shrink-0 border-l border-line bg-surface lg:block" aria-label="Properties">
            <PropertiesPanel registry={registry.data} assets={assets.data ?? []} readOnly={readOnly} />
          </aside>
        )}
      </div>

      <div className="border-t border-line bg-surface p-2 text-center text-xs text-muted md:hidden">
        The visual builder works best on a larger screen. Use a tablet or desktop to edit components.
      </div>

      <PublishDialog projectId={projectId} open={publishOpen} onOpenChange={setPublishOpen} canEdit={!readOnly} beforePublish={save} />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(o) => !o && blocker.state === 'blocked' && blocker.reset()}
        title="Leave without saving?"
        description="You have unsaved changes in the builder. They will be lost if you leave now."
        confirmLabel="Discard changes"
        onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
      />
    </div>
  )
}
