import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { workspaceApi } from '@/services/api'
import { useWorkspaceStore } from '@/stores/workspace'
import type { Workspace } from '@/types'

export const qk = {
  workspaces: ['workspaces'] as const,
  stats: (id: number) => ['workspaces', id, 'stats'] as const,
  members: (id: number) => ['workspaces', id, 'members'] as const,
  invitations: (id: number) => ['workspaces', id, 'invitations'] as const,
  projects: (params: object) => ['projects', params] as const,
  project: (id: number) => ['project', id] as const,
  projectActivity: (id: number) => ['project', id, 'activity'] as const,
  projectMembers: (id: number) => ['project', id, 'members'] as const,
  tasks: (params: object) => ['tasks', params] as const,
  activity: (params: object) => ['activity', params] as const,
  registry: ['builder', 'registry'] as const,
  pages: (project: number) => ['builder', project, 'pages'] as const,
  theme: (project: number) => ['builder', project, 'theme'] as const,
  versions: (page: number) => ['builder', 'versions', page] as const,
  assets: (project: number) => ['builder', project, 'assets'] as const,
  publications: (project: number) => ['builder', project, 'publications'] as const,
}

export function useWorkspaces() {
  return useQuery({ queryKey: qk.workspaces, queryFn: workspaceApi.list })
}

/** Resolves the active workspace (persisted id, falling back to the first membership). */
export function useCurrentWorkspace(): { workspace: Workspace | undefined; workspaces: Workspace[]; isLoading: boolean; error: unknown } {
  const { data = [], isLoading, error } = useWorkspaces()
  const { currentId, setCurrent } = useWorkspaceStore()
  const workspace = data.find((w) => w.id === currentId) ?? data[0]
  useEffect(() => {
    if (workspace && workspace.id !== currentId) setCurrent(workspace.id)
  }, [workspace, currentId, setCurrent])
  return { workspace, workspaces: data, isLoading, error }
}

export function isManager(ws?: Workspace) {
  return ws?.role === 'owner' || ws?.role === 'admin'
}

export function canContribute(ws?: Workspace) {
  return !!ws?.role && ws.role !== 'viewer'
}
