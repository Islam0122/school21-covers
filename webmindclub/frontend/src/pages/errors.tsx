import { Link, isRouteErrorResponse, useRouteError } from 'react-router'
import { LogoMark } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'

function ErrorLayout({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <LogoMark className="mb-6 size-14" />
      <p className="font-display text-sm font-semibold text-brand-blue">{code}</p>
      <h1 className="mt-2 font-display text-3xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-muted">{text}</p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/">Go home</Link>
        </Button>
        <Button asChild>
          <Link to="/app">Open workspace</Link>
        </Button>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return <ErrorLayout code="404" title="Page not found" text="The page you are looking for doesn’t exist or was moved." />
}

export function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  console.error(error)
  return <ErrorLayout code="Error" title="Something went wrong" text="An unexpected error occurred. Reload the page or go back home." />
}
