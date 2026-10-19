import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { LoadingState } from '@/components/ui/states'
import { PublicLayout } from '@/layouts/public-layout'
import { WorkspaceLayout } from '@/layouts/workspace-layout'
import { NotFoundPage, RouteErrorPage } from '@/pages/errors'
import { AuthAware, GuestOnly, RequireAuth } from './guards'

function page(loader: () => Promise<{ default: ComponentType }>) {
  const C = lazy(loader)
  return (
    <Suspense fallback={<LoadingState className="min-h-[50vh]" />}>
      <C />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AuthAware />,
        children: [
          {
            element: <PublicLayout />,
            children: [
              { index: true, element: page(() => import('@/pages/public/landing')) },
              { path: 'platform', element: page(() => import('@/pages/public/platform')) },
              { path: 'projects', element: page(() => import('@/pages/public/showcase')) },
              { path: 'about', element: page(() => import('@/pages/public/about')) },
            ],
          },
          { path: 'invite/:token', element: page(() => import('@/pages/auth/accept-invite')) },
          { path: 'sites/:slug/:pageSlug?', element: page(() => import('@/pages/site/published-site')) },
        ],
      },
      {
        element: <GuestOnly />,
        children: [
          { path: 'signin', element: page(() => import('@/pages/auth/sign-in')) },
          { path: 'signup', element: page(() => import('@/pages/auth/sign-up')) },
          { path: 'forgot-password', element: page(() => import('@/pages/auth/forgot-password')) },
          { path: 'reset-password', element: page(() => import('@/pages/auth/reset-password')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            path: 'app',
            element: <WorkspaceLayout />,
            children: [
              { index: true, element: page(() => import('@/pages/app/overview')) },
              { path: 'projects', element: page(() => import('@/pages/app/projects')) },
              { path: 'projects/new', element: page(() => import('@/pages/app/create-project')) },
              { path: 'projects/:projectId/:tab?', element: page(() => import('@/pages/app/project-workspace')) },
              { path: 'builder', element: page(() => import('@/pages/app/builder-index')) },
              { path: 'templates', element: page(() => import('@/pages/app/templates')) },
              { path: 'team', element: page(() => import('@/pages/app/team')) },
              { path: 'tasks', element: page(() => import('@/pages/app/tasks')) },
              { path: 'activity', element: page(() => import('@/pages/app/activity')) },
              { path: 'settings/:tab?', element: page(() => import('@/pages/app/settings')) },
              { path: 'profile', element: page(() => import('@/pages/app/profile')) },
            ],
          },
          { path: 'app/builder/:projectId', element: page(() => import('@/pages/builder/editor')) },
          { path: 'preview/:projectId/:pageSlug?', element: page(() => import('@/pages/site/draft-preview')) },
          { path: 'smartstock/:storeId/*', element: page(() => import('@/pages/smartstock/smartstock-app')) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
