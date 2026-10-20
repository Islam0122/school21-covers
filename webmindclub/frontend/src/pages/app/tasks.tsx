import { PageHeader } from '@/components/ui/page-header'
import { TaskBoard } from '@/features/tasks/task-board'
import { canContribute, useCurrentWorkspace } from '@/hooks/use-workspace'

export default function TasksPage() {
  const { workspace } = useCurrentWorkspace()
  return (
    <div className="animate-fade-in">
      <PageHeader title="Tasks" description="All tasks across projects you can access. Drag cards between columns to change status." />
      <TaskBoard canEdit={canContribute(workspace)} />
    </div>
  )
}
