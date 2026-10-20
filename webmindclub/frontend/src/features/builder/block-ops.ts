import { uid } from '@/lib/utils'
import type { Block, BlockStyle, ComponentSpec, FieldSpec, Registry } from '@/types'

const clone = <T,>(v: T): T => structuredClone(v)

export function createBlock(registry: Registry, type: string): Block {
  const spec = registry.components.find((c) => c.type === type)
  if (!spec) throw new Error(`Unknown component ${type}`)
  const style = Object.fromEntries(Object.entries(registry.style).map(([k, f]) => [k, f.default])) as unknown as BlockStyle
  return {
    id: uid('b'),
    type,
    props: Object.fromEntries(Object.entries(spec.props).map(([k, f]) => [k, clone(f.default)])),
    style: { ...style, ...(spec.styleDefaults as Partial<BlockStyle>) },
    hidden: false,
    hiddenOn: [],
  }
}

export function insertBlock(blocks: Block[], block: Block, afterId?: string | null): Block[] {
  const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : -1
  if (idx === -1) return [...blocks, block]
  return [...blocks.slice(0, idx + 1), block, ...blocks.slice(idx + 1)]
}

export function removeBlock(blocks: Block[], id: string): Block[] {
  return blocks.filter((b) => b.id !== id)
}

export function duplicateBlock(blocks: Block[], id: string): { blocks: Block[]; newId: string | null } {
  const src = blocks.find((b) => b.id === id)
  if (!src) return { blocks, newId: null }
  const copy = { ...clone(src), id: uid('b') }
  return { blocks: insertBlock(blocks, copy, id), newId: copy.id }
}

export function moveBlock(blocks: Block[], id: string, delta: number): Block[] {
  const from = blocks.findIndex((b) => b.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= blocks.length) return blocks
  return reorder(blocks, from, to)
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function updateBlock(blocks: Block[], id: string, patch: { props?: Record<string, unknown>; style?: Partial<BlockStyle>; hidden?: boolean; hiddenOn?: Block['hiddenOn'] }): Block[] {
  return blocks.map((b) =>
    b.id === id
      ? {
          ...b,
          props: patch.props ? { ...b.props, ...patch.props } : b.props,
          style: patch.style ? { ...b.style, ...patch.style } : b.style,
          hidden: patch.hidden ?? b.hidden,
          hiddenOn: patch.hiddenOn ?? b.hiddenOn,
        }
      : b,
  )
}

export function freshIds(blocks: Block[]): Block[] {
  return blocks.map((b) => ({ ...clone(b), id: uid('b') }))
}

const SAFE_LINK = /^(\/(?!\/)\S*|#[\w-]*|https?:\/\/\S+|mailto:\S+|tel:[+\d\-\s()]+)?$/i
const SAFE_IMG = /^(https?:\/\/[^\s"'<>]+|\/media\/[\w\-./]+)?$/i
const HEX = /^(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}))?$/

/** Client-side mirror of the server validator for instant feedback (the server remains authoritative). */
export function fieldError(spec: FieldSpec, value: unknown): string | null {
  switch (spec.type) {
    case 'text':
    case 'textarea':
      return typeof value === 'string' && spec.max && value.length > spec.max ? `Max ${spec.max} characters.` : null
    case 'url':
      return SAFE_LINK.test(String(value ?? '')) ? null : 'Use /page, #anchor, https://, mailto: or tel:.'
    case 'image':
      return SAFE_IMG.test(String(value ?? '')) ? null : 'Use an uploaded asset or an https:// image URL.'
    case 'color':
      return HEX.test(String(value ?? '')) ? null : 'Use a hex color like #2563EB.'
    case 'number': {
      const n = Number(value)
      return Number.isFinite(n) && n >= (spec.min ?? -Infinity) && n <= (spec.max ?? Infinity) ? null : `Between ${spec.min} and ${spec.max}.`
    }
    default:
      return null
  }
}

export function validateBlocks(blocks: Block[], registry: Registry): string | null {
  const byType = new Map<string, ComponentSpec>(registry.components.map((c) => [c.type, c]))
  for (const b of blocks) {
    const spec = byType.get(b.type)
    if (!spec) return `Unknown component ${b.type}`
    for (const [key, f] of Object.entries(spec.props)) {
      if (f.type === 'list') {
        for (const [i, item] of (b.props[key] as Record<string, unknown>[]).entries()) {
          for (const [k, sub] of Object.entries(f.fields ?? {})) {
            const err = fieldError(sub, item[k])
            if (err) return `${spec.label} › ${f.label} #${i + 1} › ${sub.label}: ${err}`
          }
        }
      } else {
        const err = fieldError(f, b.props[key])
        if (err) return `${spec.label} › ${f.label}: ${err}`
      }
    }
    for (const [key, f] of Object.entries(registry.style)) {
      const err = fieldError(f, (b.style as unknown as Record<string, unknown>)[key])
      if (err) return `${spec.label} › ${f.label}: ${err}`
    }
  }
  return null
}
