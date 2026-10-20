import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as React from 'react'
import { cn } from '@/lib/utils'

export const Dropdown = DropdownMenu.Root
export const DropdownTrigger = DropdownMenu.Trigger

export function DropdownContent({ className, align = 'end', ...props }: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn('z-50 min-w-44 rounded-xl border border-line bg-elevated p-1 shadow-xl animate-fade-in', className)}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

export function DropdownItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<typeof DropdownMenu.Item> & { destructive?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover [&_svg]:size-4',
        destructive ? 'text-red-500' : 'text-fg',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownLabel(props: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className="px-2.5 py-1.5 text-xs font-medium text-muted" {...props} />
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />
}
