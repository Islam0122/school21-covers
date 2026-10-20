export interface User {
  id: number
  email: string
  full_name: string
  display_name: string
  avatar: string | null
  appearance?: 'dark' | 'light' | 'system'
  date_joined?: string
}

export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'designer' | 'project_manager' | 'viewer'

export interface Workspace {
  id: number
  name: string
  slug: string
  logo: string | null
  theme: 'dark' | 'light'
  role: WorkspaceRole | null
  member_count: number
  created_at: string
}

export interface Membership {
  id: number
  workspace: number
  user: User
  role: WorkspaceRole
  role_label: string
  project_ids: number[]
  created_at: string
}

export interface Invitation {
  id: number
  workspace: number
  email: string
  role: WorkspaceRole
  status: 'pending' | 'accepted' | 'revoked'
  invited_by: User | null
  expires_at: string
  is_expired: boolean
  projects: number[]
  invite_url: string | null
  created_at: string
  email_delivery_configured?: boolean
}

export type ProjectType = 'website' | 'saas' | 'ecommerce' | 'dashboard' | 'landing' | 'internal_tool'
export type ProjectStatus = 'draft' | 'in_progress' | 'review' | 'published' | 'archived'

export interface Publication {
  is_live: boolean
  slug: string | null
  url: string | null
  version: number | null
  published_at: string | null
}

export interface Project {
  id: number
  workspace: number
  name: string
  slug: string
  description: string
  project_type: ProjectType
  type_label: string
  status: ProjectStatus
  status_label: string
  visibility: 'private' | 'workspace'
  template: string
  logo: string | null
  owner: User
  members: User[]
  has_store: boolean
  permissions: { edit: boolean; manage: boolean }
  created_at: string
  updated_at: string
  publication?: Publication
  counts?: { pages: number; tasks: number; open_tasks: number; members: number }
}

export interface ProjectMember {
  id: number
  user: User
  role: 'lead' | 'editor' | 'viewer'
  created_at: string
}

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Task {
  id: number
  project: number
  project_name: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignee: User | null
  due_date: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface Activity {
  id: number
  workspace: number
  project: number | null
  project_name: string | null
  actor: User | null
  verb: string
  target_type: string
  message: string
  created_at: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface WorkspaceStats {
  total_projects: number
  active_projects: number
  published_projects: number
  team_members: number
  open_tasks: number
  overdue_tasks: number
  recent_projects: Project[]
  upcoming_tasks: Task[]
  recent_activity: Activity[]
  projects_by_status: { status: ProjectStatus; label: string; count: number }[]
}

/* ---------------- Builder ---------------- */

export type FieldType = 'text' | 'textarea' | 'url' | 'image' | 'color' | 'number' | 'select' | 'icon' | 'boolean' | 'list'

export interface FieldSpec {
  type: FieldType
  label: string
  default: unknown
  max?: number
  min?: number
  options?: (string | number)[]
  fields?: Record<string, FieldSpec>
}

export interface ComponentSpec {
  type: string
  label: string
  category: string
  props: Record<string, FieldSpec>
  styleDefaults: Record<string, unknown>
}

export interface ThemeTokens {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  mutedText: string
  headingFont: string
  bodyFont: string
  radius: number
  buttonStyle: 'solid' | 'outline' | 'pill'
  containerWidth: number
}

export interface ThemePreset {
  key: string
  name: string
  tokens: ThemeTokens
}

export interface Registry {
  components: ComponentSpec[]
  style: Record<string, FieldSpec>
  theme: Record<keyof ThemeTokens, FieldSpec>
  presets: ThemePreset[]
  icons: string[]
  fonts: string[]
  devices: Device[]
}

export type Device = 'desktop' | 'tablet' | 'mobile'

export interface BlockStyle {
  paddingTop: number
  paddingBottom: number
  background: string
  textColor: string
  align: 'left' | 'center' | 'right'
  fontScale: number
  borderWidth: number
  borderColor: string
  radius: number
  width: 'narrow' | 'normal' | 'wide' | 'full'
}

export interface Block {
  id: string
  type: string
  props: Record<string, any>
  style: BlockStyle
  hidden: boolean
  hiddenOn: Device[]
}

export interface PageContent {
  version?: number
  blocks: Block[]
}

export interface WebsitePage {
  id: number
  project: number
  title: string
  slug: string
  seo_title: string
  seo_description: string
  content: PageContent
  position: number
  status: 'draft' | 'published'
  is_home: boolean
  version_count: number
  created_at: string
  updated_at: string
}

export interface PageVersion {
  id: number
  page: number
  title: string
  note: string
  block_count: number
  created_by: User | null
  created_at: string
}

export interface Theme {
  preset: string
  tokens: ThemeTokens
  updated_at: string
}

export interface Asset {
  id: number
  project: number
  url: string
  original_name: string
  size: number
  width: number
  height: number
  created_at: string
}

export interface SiteSnapshot {
  project: { id: number; name: string; slug: string }
  theme: ThemeTokens
  pages: { id: number; title: string; slug: string; is_home: boolean; seo_title: string; seo_description: string; content: PageContent }[]
  mode: 'preview' | 'published'
  version?: number
  published_at?: string
}

export interface PublicationVersion {
  id: number
  number: number
  action: 'publish' | 'unpublish'
  note: string
  page_count: number
  published_by: User | null
  created_at: string
}

/* ---------------- SmartStock ---------------- */

export type StoreRole = 'store_manager' | 'inventory_clerk' | 'analyst'

export interface Store {
  id: number
  project: number
  project_name: string
  name: string
  currency: string
  default_lead_time_days: number
  role: StoreRole | null
  created_at: string
}

export interface StoreStaff {
  id: number
  user: User
  role: StoreRole
  role_label: string
}

export interface Supplier {
  id: number
  store: number
  name: string
  contact_email: string
  phone: string
  lead_time_days: number
}

export interface Product {
  id: number
  store: number
  name: string
  sku: string
  category: string
  purchase_price: string
  sale_price: string
  stock: number
  min_stock: number
  expiry_date: string | null
  supplier: number | null
  supplier_name: string | null
  inventory_value: string
  margin_percent: number | null
  stock_status: 'out' | 'low' | 'ok'
  updated_at: string
}

export interface Movement {
  id: number
  product: number
  product_name: string
  sku: string
  kind: string
  kind_label: string
  quantity: number
  stock_after: number
  unit_price: string | null
  reason: string
  reference: string
  created_by: User | null
  created_at: string
}

export interface PurchaseOrder {
  id: number
  store: number
  supplier: number
  supplier_name: string
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  status_label: string
  expected_delivery: string | null
  notes: string
  items: { id?: number; product: number; product_name?: string; sku?: string; quantity: number; unit_price: string }[]
  total: string
  created_by: User | null
  received_at: string | null
  created_at: string
}

export interface Recommendation {
  id: number
  store: number
  product: number
  product_name: string
  sku: string
  supplier: number | null
  purchase_price: string
  kind: 'stockout' | 'overstock' | 'expiry' | 'reorder'
  kind_label: string
  severity: 'low' | 'medium' | 'high'
  title: string
  reason: string
  action: string
  recommended_quantity: number
  potential_savings: string
  metrics: Record<string, number | string | null>
  status: 'open' | 'dismissed' | 'applied'
  generated_at: string
}

export interface StoreDashboard {
  inventory_value: string
  retail_value: string
  products: number
  low_stock: number
  out_of_stock: number
  sales_30d: string
  units_sold_30d: number
  potential_savings: string
  open_insights: number
  sales_series: { date: string; revenue: number }[]
  category_value: { category: string; value: number }[]
  top_insights: Recommendation[]
}
