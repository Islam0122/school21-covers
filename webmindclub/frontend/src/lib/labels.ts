import type { ProjectStatus, ProjectType, TaskPriority, TaskStatus, WorkspaceRole } from '@/types'

type Tone = 'neutral' | 'blue' | 'cyan' | 'purple' | 'green' | 'amber' | 'red'

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'website', label: 'Website' },
  { value: 'saas', label: 'SaaS' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'landing', label: 'Landing Page' },
  { value: 'internal_tool', label: 'Internal Tool' },
]

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: Tone }[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'in_progress', label: 'In Progress', tone: 'blue' },
  { value: 'review', label: 'Ready for Review', tone: 'amber' },
  { value: 'published', label: 'Published', tone: 'green' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
]

export const statusTone = (s: ProjectStatus): Tone => PROJECT_STATUSES.find((x) => x.value === s)?.tone ?? 'neutral'

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: 'todo', label: 'Todo', tone: 'neutral' },
  { value: 'in_progress', label: 'In Progress', tone: 'blue' },
  { value: 'review', label: 'Review', tone: 'amber' },
  { value: 'done', label: 'Done', tone: 'green' },
]

export const TASK_PRIORITIES: { value: TaskPriority; label: string; tone: Tone }[] = [
  { value: 'low', label: 'Low', tone: 'neutral' },
  { value: 'medium', label: 'Medium', tone: 'cyan' },
  { value: 'high', label: 'High', tone: 'amber' },
  { value: 'urgent', label: 'Urgent', tone: 'red' },
]

export const WORKSPACE_ROLES: { value: WorkspaceRole; label: string; description: string }[] = [
  { value: 'owner', label: 'Workspace Owner', description: 'Full control, billing and deletion.' },
  { value: 'admin', label: 'Admin', description: 'Manage members, settings and all projects.' },
  { value: 'developer', label: 'Developer', description: 'Edit assigned projects.' },
  { value: 'designer', label: 'Designer', description: 'Edit assigned projects and designs.' },
  { value: 'project_manager', label: 'Project Manager', description: 'Plan tasks on assigned projects.' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to assigned projects.' },
]

export const roleLabel = (r?: string | null) => WORKSPACE_ROLES.find((x) => x.value === r)?.label ?? r ?? '—'
