import type { Registry } from '@/types'

const f = (type: string, label: string, def: unknown, extra: object = {}) => ({ type, label, default: def, ...extra }) as never

export const registry: Registry = {
  components: [
    { type: 'heading', label: 'Heading', category: 'Basic', styleDefaults: { paddingTop: 32 }, props: { text: f('text', 'Text', 'Section heading', { max: 160 }), level: f('select', 'Level', 'h2', { options: ['h1', 'h2', 'h3'] }) } },
    { type: 'button', label: 'Button', category: 'Basic', styleDefaults: {}, props: { label: f('text', 'Label', 'Click me', { max: 40 }), href: f('url', 'Link', '#'), variant: f('select', 'Variant', 'primary', { options: ['primary', 'outline'] }) } },
    { type: 'features', label: 'Feature Cards', category: 'Sections', styleDefaults: {}, props: { title: f('text', 'Title', 'Everything', { max: 120 }), subtitle: f('textarea', 'Subtitle', '', { max: 300 }), columns: f('select', 'Columns', '3', { options: ['2', '3', '4'] }), items: f('list', 'Features', [{ icon: 'zap', title: 'Fast', text: 'Quick' }], { max: 12, fields: { icon: f('icon', 'Icon', 'sparkles', { options: ['zap', 'sparkles'] }), title: f('text', 'Title', '', { max: 80 }), text: f('textarea', 'Text', '', { max: 300 }) } }) } },
  ],
  style: {
    paddingTop: f('number', 'Padding top', 64, { min: 0, max: 240 }),
    paddingBottom: f('number', 'Padding bottom', 64, { min: 0, max: 240 }),
    background: f('color', 'Background', ''),
    textColor: f('color', 'Text color', ''),
    align: f('select', 'Alignment', 'left', { options: ['left', 'center', 'right'] }),
    fontScale: f('number', 'Font size', 100, { min: 70, max: 160 }),
    borderWidth: f('number', 'Border width', 0, { min: 0, max: 8 }),
    borderColor: f('color', 'Border color', ''),
    radius: f('number', 'Radius', 0, { min: 0, max: 48 }),
    width: f('select', 'Width', 'normal', { options: ['narrow', 'normal', 'wide', 'full'] }),
  },
  theme: {} as never,
  presets: [],
  icons: ['zap', 'sparkles'],
  fonts: ['Inter'],
  devices: ['desktop', 'tablet', 'mobile'],
}

export const theme = {
  primary: '#2563EB', secondary: '#7C3AED', background: '#FFFFFF', surface: '#F8FAFC', text: '#0F172A', mutedText: '#64748B',
  headingFont: 'Inter', bodyFont: 'Inter', radius: 12, buttonStyle: 'solid', containerWidth: 1200,
} as const
