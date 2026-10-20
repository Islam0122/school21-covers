import { registry } from '@/test/fixtures'
import { createBlock, duplicateBlock, fieldError, insertBlock, moveBlock, removeBlock, updateBlock, validateBlocks } from './block-ops'

describe('block operations', () => {
  it('creates blocks with registry defaults and component style overrides', () => {
    const b = createBlock(registry, 'heading')
    expect(b.props).toEqual({ text: 'Section heading', level: 'h2' })
    expect(b.style.paddingTop).toBe(32)
    expect(b.style.paddingBottom).toBe(64)
    expect(b.hidden).toBe(false)
  })

  it('inserts after the selected block, removes, duplicates and moves', () => {
    const a = createBlock(registry, 'heading')
    const c = createBlock(registry, 'button')
    let list = insertBlock(insertBlock([], a), c)
    const b = createBlock(registry, 'features')
    list = insertBlock(list, b, a.id)
    expect(list.map((x) => x.type)).toEqual(['heading', 'features', 'button'])
    const dup = duplicateBlock(list, b.id)
    expect(dup.blocks).toHaveLength(4)
    expect(dup.blocks[2].id).not.toBe(b.id)
    expect(dup.blocks[2].props).toEqual(b.props)
    expect(dup.blocks[2].props).not.toBe(b.props)
    expect(moveBlock(list, c.id, -1).map((x) => x.type)).toEqual(['heading', 'button', 'features'])
    expect(moveBlock(list, a.id, -1)).toBe(list)
    expect(removeBlock(list, b.id).map((x) => x.id)).toEqual([a.id, c.id])
  })

  it('updates props and style immutably', () => {
    const a = createBlock(registry, 'heading')
    const [next] = updateBlock([a], a.id, { props: { text: 'Hello' }, style: { fontScale: 120 }, hiddenOn: ['mobile'] })
    expect(next.props.text).toBe('Hello')
    expect(next.style.fontScale).toBe(120)
    expect(next.hiddenOn).toEqual(['mobile'])
    expect(a.props.text).toBe('Section heading')
  })

  it('rejects unsafe links and invalid values before saving', () => {
    expect(fieldError({ type: 'url', label: 'Link', default: '' }, 'javascript:alert(1)')).toMatch(/Use/)
    expect(fieldError({ type: 'url', label: 'Link', default: '' }, '/about')).toBeNull()
    expect(fieldError({ type: 'image', label: 'Image', default: '' }, 'data:image/png;base64,AAA')).not.toBeNull()
    expect(fieldError({ type: 'color', label: 'C', default: '' }, 'red')).not.toBeNull()
    const btn = createBlock(registry, 'button')
    btn.props.href = 'javascript:alert(1)'
    expect(validateBlocks([btn], registry)).toMatch(/Button › Link/)
    const feat = createBlock(registry, 'features')
    feat.props.items[0].title = 'x'.repeat(81)
    expect(validateBlocks([feat], registry)).toMatch(/Feature Cards › Features #1 › Title/)
  })
})
