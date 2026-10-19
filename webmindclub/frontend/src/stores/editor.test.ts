import { createBlock } from '@/features/builder/block-ops'
import { registry } from '@/test/fixtures'
import { useEditor } from './editor'

describe('editor store', () => {
  beforeEach(() => useEditor.getState().loadPage(1, []))

  it('supports undo and redo of structural changes', () => {
    const s = () => useEditor.getState()
    const a = createBlock(registry, 'heading')
    s().add(a)
    s().add(createBlock(registry, 'button'))
    expect(s().blocks).toHaveLength(2)
    expect(s().dirty).toBe(true)
    s().undo()
    expect(s().blocks).toHaveLength(1)
    s().redo()
    expect(s().blocks).toHaveLength(2)
    s().remove(a.id)
    expect(s().blocks.map((b) => b.type)).toEqual(['button'])
    expect(s().future).toHaveLength(0)
  })

  it('coalesces rapid typing into one history entry', () => {
    const s = () => useEditor.getState()
    const a = createBlock(registry, 'heading')
    s().add(a)
    const before = s().past.length
    for (const text of ['H', 'He', 'Hel', 'Hello']) s().patch(a.id, { props: { text } }, `${a.id}:text`)
    expect(s().past.length).toBe(before + 1)
    s().undo()
    expect(s().blocks[0].props.text).toBe('Section heading')
  })

  it('tracks theme changes separately from page content', () => {
    useEditor.getState().loadTheme('modern-dark', { primary: '#000000' } as never)
    useEditor.getState().setTheme({ primary: '#FF0000' })
    expect(useEditor.getState().themeDirty).toBe(true)
    expect(useEditor.getState().preset).toBe('custom')
    useEditor.getState().markSaved('theme')
    expect(useEditor.getState().themeDirty).toBe(false)
  })
})
