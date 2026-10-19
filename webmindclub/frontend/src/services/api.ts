/**
 * Typed API surface used by the UI. Components never call `fetch` directly, so the
 * transport (REST today) can be swapped without touching pages or features.
 */
import type {
  Activity, Asset, Invitation, Membership, Movement, Paginated, PageVersion, Product, Project, ProjectMember,
  PublicationVersion, Publication, PurchaseOrder, Recommendation, Registry, SiteSnapshot, Store, StoreDashboard,
  StoreStaff, Supplier, Task, Theme, ThemeTokens, User, WebsitePage, Workspace, WorkspaceStats, PageContent,
} from '@/types'
import { http } from './http'

export const authApi = {
  me: () => http.get<User>('/api/auth/me/'),
  session: () => http.get<{ user: User | null }>('/api/auth/session/'),
  login: (data: { email: string; password: string }) => http.post<User>('/api/auth/login/', data),
  register: (data: { full_name: string; email: string; password: string; workspace_name?: string }) =>
    http.post<User>('/api/auth/register/', data),
  logout: () => http.post<void>('/api/auth/logout/'),
  updateMe: (data: Partial<User> | FormData) => http.patch<User>('/api/auth/me/', data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    http.post<void>('/api/auth/password/change/', data),
  requestReset: (email: string) =>
    http.post<{ detail: string; email_delivery_configured: boolean }>('/api/auth/password/reset/', { email }),
  confirmReset: (data: { uid: string; token: string; new_password: string }) =>
    http.post<void>('/api/auth/password/reset/confirm/', data),
}

export const workspaceApi = {
  list: () => http.get<Workspace[]>('/api/workspaces/'),
  create: (name: string) => http.post<Workspace>('/api/workspaces/', { name }),
  update: (id: number, data: Partial<Workspace> | FormData) => http.patch<Workspace>(`/api/workspaces/${id}/`, data),
  stats: (id: number) => http.get<WorkspaceStats>(`/api/workspaces/${id}/stats/`),
  loadDemo: (id: number) => http.post<{ project_id: number }>(`/api/workspaces/${id}/load-demo/`),
  members: (workspace: number) => http.get<Membership[]>('/api/workspace-members/', { workspace }),
  updateMember: (id: number, role: string) => http.patch<Membership>(`/api/workspace-members/${id}/`, { role }),
  removeMember: (id: number) => http.delete(`/api/workspace-members/${id}/`),
  invitations: (workspace: number) => http.get<Invitation[]>('/api/invitations/', { workspace, status: 'pending' }),
  invite: (data: { workspace: number; email: string; role: string; projects: number[] }) =>
    http.post<Invitation>('/api/invitations/', data),
  revokeInvitation: (id: number) => http.delete(`/api/invitations/${id}/`),
  previewInvitation: (token: string) =>
    http.get<{ workspace: string; email: string; role: string }>(`/api/invitations/preview/${token}/`),
  acceptInvitation: (token: string) => http.post<Workspace>('/api/invitations/accept/', { token }),
}

export interface ProjectQuery {
  workspace?: number
  search?: string
  status?: string
  project_type?: string
  ordering?: string
  include_archived?: boolean
  [key: string]: string | number | boolean | undefined
}

export const projectApi = {
  list: (q: ProjectQuery) => http.get<Paginated<Project>>('/api/projects/', q),
  get: (id: number) => http.get<Project>(`/api/projects/${id}/`),
  create: (data: Record<string, unknown>) => http.post<Project>('/api/projects/', data),
  update: (id: number, data: Partial<Project> | FormData) => http.patch<Project>(`/api/projects/${id}/`, data),
  remove: (id: number) => http.delete(`/api/projects/${id}/`),
  duplicate: (id: number) => http.post<Project>(`/api/projects/${id}/duplicate/`),
  archive: (id: number) => http.post<Project>(`/api/projects/${id}/archive/`),
  restore: (id: number) => http.post<Project>(`/api/projects/${id}/restore/`),
  activity: (id: number) => http.get<Activity[]>(`/api/projects/${id}/activity/`),
  members: (id: number) => http.get<ProjectMember[]>(`/api/projects/${id}/members/`),
  addMember: (id: number, user_id: number, role: string) =>
    http.post<ProjectMember[]>(`/api/projects/${id}/members/`, { user_id, role }),
  removeMember: (id: number, memberId: number) => http.delete(`/api/projects/${id}/members/${memberId}/`),
}

export const builderApi = {
  registry: () => http.get<Registry>('/api/builder/components/'),
  pages: (project: number) => http.get<WebsitePage[]>('/api/pages/', { project }),
  createPage: (data: Partial<WebsitePage>) => http.post<WebsitePage>('/api/pages/', data),
  updatePage: (id: number, data: Partial<WebsitePage> & { note?: string }) => http.patch<WebsitePage>(`/api/pages/${id}/`, data),
  savePageContent: (id: number, content: PageContent) => http.patch<WebsitePage>(`/api/pages/${id}/`, { content }),
  deletePage: (id: number) => http.delete(`/api/pages/${id}/`),
  reorderPages: (project: number, order: number[]) => http.post<WebsitePage[]>('/api/pages/reorder/', { project, order }),
  versions: (pageId: number) => http.get<PageVersion[]>(`/api/pages/${pageId}/versions/`),
  restoreVersion: (pageId: number, version: number) => http.post<WebsitePage>(`/api/pages/${pageId}/restore/`, { version }),
  theme: (project: number) => http.get<Theme>(`/api/projects/${project}/theme/`),
  saveTheme: (project: number, data: { preset: string; tokens: ThemeTokens }) =>
    http.put<Theme>(`/api/projects/${project}/theme/`, data),
  preview: (project: number) => http.get<SiteSnapshot>(`/api/projects/${project}/preview/`),
  publish: (project: number, note = '') => http.post<Publication>(`/api/projects/${project}/publish/`, { note }),
  unpublish: (project: number) => http.delete<Publication>(`/api/projects/${project}/publish/`),
  publications: (project: number) =>
    http.get<{ site: Publication; versions: PublicationVersion[] }>(`/api/projects/${project}/publications/`),
  publicSite: (slug: string) => http.get<SiteSnapshot>(`/api/public/sites/${slug}/`),
  assets: (project: number) => http.get<Asset[]>('/api/assets/', { project }),
  uploadAsset: (project: number, file: File) => {
    const fd = new FormData()
    fd.append('project', String(project))
    fd.append('file', file)
    return http.post<Asset>('/api/assets/', fd)
  },
  deleteAsset: (id: number) => http.delete(`/api/assets/${id}/`),
}

export const taskApi = {
  list: (q: { workspace?: number; project?: number; status?: string; assignee?: number; search?: string }) =>
    http.get<Task[]>('/api/tasks/', q),
  create: (data: Partial<Task> & { assignee_id?: number | null }) => http.post<Task>('/api/tasks/', data),
  update: (id: number, data: Partial<Task> & { assignee_id?: number | null }) => http.patch<Task>(`/api/tasks/${id}/`, data),
  remove: (id: number) => http.delete(`/api/tasks/${id}/`),
}

export const activityApi = {
  list: (q: { workspace?: number; project?: number; page?: number; search?: string }) =>
    http.get<Paginated<Activity>>('/api/activity/', q),
}

const S = '/api/smartstock'
export const smartstockApi = {
  stores: (project?: number) => http.get<Store[]>(`${S}/stores/`, { project }),
  store: (id: number) => http.get<Store>(`${S}/stores/${id}/`),
  createStore: (data: { project: number; name: string; currency: string }) => http.post<Store>(`${S}/stores/`, data),
  dashboard: (id: number) => http.get<StoreDashboard>(`${S}/stores/${id}/dashboard/`),
  staff: (id: number) => http.get<StoreStaff[]>(`${S}/stores/${id}/staff/`),
  setStaff: (id: number, user_id: number, role: string) => http.post<StoreStaff[]>(`${S}/stores/${id}/staff/`, { user_id, role }),
  removeStaff: (id: number, staffId: number) => http.delete(`${S}/stores/${id}/staff/${staffId}/`),
  regenerate: (id: number) => http.post<Recommendation[]>(`${S}/stores/${id}/regenerate-insights/`),
  products: (q: Record<string, string | number | undefined>) => http.get<Paginated<Product>>(`${S}/products/`, q),
  categories: (store: number) => http.get<string[]>(`${S}/products/categories/`, { store }),
  createProduct: (data: Record<string, unknown>) => http.post<Product>(`${S}/products/`, data),
  updateProduct: (id: number, data: Record<string, unknown>) => http.patch<Product>(`${S}/products/${id}/`, data),
  deleteProduct: (id: number) => http.delete(`${S}/products/${id}/`),
  adjust: (id: number, data: { kind: string; quantity: number; reason?: string }) =>
    http.post<Product>(`${S}/products/${id}/adjust/`, data),
  exportCsv: (q: Record<string, string | number | undefined>) => http.get<Blob>(`${S}/products/export/`, q),
  movements: (q: Record<string, string | number | undefined>) => http.get<Paginated<Movement>>(`${S}/movements/`, q),
  suppliers: (store: number) => http.get<Supplier[]>(`${S}/suppliers/`, { store }),
  createSupplier: (data: Partial<Supplier>) => http.post<Supplier>(`${S}/suppliers/`, data),
  updateSupplier: (id: number, data: Partial<Supplier>) => http.patch<Supplier>(`${S}/suppliers/${id}/`, data),
  deleteSupplier: (id: number) => http.delete(`${S}/suppliers/${id}/`),
  orders: (q: Record<string, string | number | undefined>) => http.get<Paginated<PurchaseOrder>>(`${S}/orders/`, q),
  createOrder: (data: Record<string, unknown>) => http.post<PurchaseOrder>(`${S}/orders/`, data),
  updateOrder: (id: number, data: Record<string, unknown>) => http.patch<PurchaseOrder>(`${S}/orders/${id}/`, data),
  deleteOrder: (id: number) => http.delete(`${S}/orders/${id}/`),
  orderAction: (id: number, action: 'place' | 'receive' | 'cancel') => http.post<PurchaseOrder>(`${S}/orders/${id}/${action}/`),
  recommendations: (store: number, q: Record<string, string | undefined> = {}) =>
    http.get<Recommendation[]>(`${S}/recommendations/`, { store, ...q }),
  dismiss: (id: number) => http.post<Recommendation>(`${S}/recommendations/${id}/dismiss/`),
  orderFromInsight: (id: number) => http.post<PurchaseOrder>(`${S}/recommendations/${id}/create-order/`),
}
