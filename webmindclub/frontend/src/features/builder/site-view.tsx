import { useEffect, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useDevice } from '@/hooks/use-device'
import type { SiteSnapshot } from '@/types'
import { SiteRenderer } from './renderer'

export function SiteView({ site, pageSlug, basePath, banner }: { site: SiteSnapshot; pageSlug?: string; basePath: string; banner?: ReactNode }) {
  const navigate = useNavigate()
  const device = useDevice()
  const home = site.pages.find((p) => p.is_home) ?? site.pages[0]
  const page = pageSlug ? site.pages.find((p) => p.slug === pageSlug) : home

  useEffect(() => {
    if (!page) return
    document.title = page.seo_title || `${page.title} · ${site.project.name}`
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previous = meta?.content
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = page.seo_description
    window.scrollTo(0, 0)
    return () => {
      document.title = 'WebMindClub — Create. Develop. Launch.'
      if (meta && previous !== undefined) meta.content = previous
    }
  }, [page, site.project.name])

  const resolveLink = (href: string) => {
    if (href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href)) return { href, internal: false }
    const slug = href.replace(/^\/+/, '').split(/[?#]/)[0]
    const target = slug === '' ? home : site.pages.find((p) => p.slug === slug)
    if (!target) return null // link to a page that is not part of this site
    const to = target.id === home?.id ? basePath : `${basePath}/${target.slug}`
    return {
      href: to,
      internal: true,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault()
        navigate(to)
      },
    }
  }

  if (!page)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-white text-slate-700">
        {banner}
        <p className="text-lg font-semibold">Page not found</p>
        <button className="text-blue-600 underline cursor-pointer" onClick={() => navigate(basePath)}>
          Go to home page
        </button>
      </div>
    )

  return (
    <div className="min-h-screen" style={{ background: site.theme.background }}>
      {banner}
      <SiteRenderer blocks={page.content.blocks ?? []} ctx={{ theme: site.theme, resolveLink }} device={device} />
      {page.content.blocks.length === 0 && (
        <p className="py-32 text-center text-sm" style={{ color: site.theme.mutedText }}>
          This page has no content yet.
        </p>
      )}
    </div>
  )
}
