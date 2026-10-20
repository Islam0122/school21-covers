import { AtSign, Menu, MessageCircle, Rss, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/stores/auth'

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/platform', label: 'Platform' },
  { to: '/projects', label: 'Projects' },
  { to: '/about', label: 'About' },
]

function PublicNavbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const user = useAuth((s) => s.user)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-colors',
        scrolled ? 'border-b border-line bg-bg/85 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Logo />
        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'text-fg' : 'text-muted hover:text-fg')
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild variant="gradient">
              <Link to="/app">Open workspace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/signin">Sign in</Link>
              </Button>
              <Button asChild variant="gradient">
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </nav>
      {open && (
        <div className="border-t border-line bg-bg px-4 pb-4 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-hover">
              {n.label}
            </NavLink>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {user ? (
              <Button asChild variant="gradient" className="col-span-2">
                <Link to="/app">Open workspace</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline">
                  <Link to="/signin">Sign in</Link>
                </Button>
                <Button asChild variant="gradient">
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function PublicFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <Logo tagline />
          <p className="mt-4 text-sm text-muted">Design, build and launch digital products with one connected workspace.</p>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Navigation</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link className="hover:text-fg" to={n.to}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Projects</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <Link className="hover:text-fg" to="/projects">
                SmartStock AI
              </Link>
            </li>
            <li>
              <Link className="hover:text-fg" to="/platform">
                Website Builder
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>hello@example.com</li>
            <li>Demo placeholder address</li>
          </ul>
          <div className="mt-4 flex gap-2">
            {[AtSign, MessageCircle, Rss].map((Icon, i) => (
              <span key={i} title="Social profile placeholder — not connected" className="rounded-lg border border-line p-2 text-muted">
                <Icon className="size-4" aria-hidden />
                <span className="sr-only">Social profile placeholder</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-line py-6 text-center text-xs text-muted">© {new Date().getFullYear()} WebMindClub. All rights reserved.</div>
    </footer>
  )
}

export function PublicLayout() {
  const location = useLocation()
  useEffect(() => window.scrollTo(0, 0), [location.pathname])
  return (
    <div className="min-h-screen">
      <PublicNavbar />
      <main>
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
