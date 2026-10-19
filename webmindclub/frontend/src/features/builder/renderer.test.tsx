import { render, screen } from '@testing-library/react'
import { registry, theme } from '@/test/fixtures'
import type { ThemeTokens } from '@/types'
import { createBlock } from './block-ops'
import { SiteRenderer } from './renderer'

const ctx = (resolve = true) => ({
  theme: theme as unknown as ThemeTokens,
  resolveLink: resolve ? (href: string) => ({ href, internal: true }) : undefined,
})

describe('site renderer', () => {
  it('renders user text as text, never HTML', () => {
    const b = createBlock(registry, 'heading')
    b.props.text = '<img src=x onerror=alert(1)>'
    const { container } = render(<SiteRenderer blocks={[b]} ctx={ctx()} />)
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })

  it('does not create anchors for unsafe links', () => {
    const b = createBlock(registry, 'button')
    b.props = { label: 'Evil', href: 'javascript:alert(1)', variant: 'primary' }
    render(<SiteRenderer blocks={[b]} ctx={ctx()} />)
    expect(screen.getByText('Evil').closest('a')).toBeNull()
  })

  it('renders safe links and respects visibility per device', () => {
    const ok = createBlock(registry, 'button')
    ok.props = { label: 'About', href: '/about', variant: 'primary' }
    const hidden = createBlock(registry, 'heading')
    hidden.props.text = 'Desktop only'
    hidden.hiddenOn = ['mobile']
    const { rerender } = render(<SiteRenderer blocks={[ok, hidden]} ctx={ctx()} device="desktop" />)
    expect(screen.getByText('About').closest('a')).toHaveAttribute('href', '/about')
    expect(screen.getByText('Desktop only')).toBeInTheDocument()
    rerender(<SiteRenderer blocks={[ok, hidden]} ctx={ctx()} device="mobile" />)
    expect(screen.queryByText('Desktop only')).toBeNull()
  })

  it('renders list components such as feature cards', () => {
    render(<SiteRenderer blocks={[createBlock(registry, 'features')]} ctx={ctx(false)} />)
    expect(screen.getByText('Fast')).toBeInTheDocument()
    expect(screen.getByText('Quick')).toBeInTheDocument()
  })
})
