import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Globe, LayoutDashboard, LayoutTemplate, Rocket, ShoppingBag, Upload, Wrench, Boxes } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/input'
import { FONTS, TEMPLATES } from '@/features/projects/templates'
import { canContribute, useCurrentWorkspace } from '@/hooks/use-workspace'
import { applyServerErrors } from '@/lib/forms'
import { cn, slugify } from '@/lib/utils'
import { projectApi } from '@/services/api'
import { EmptyState } from '@/components/ui/states'

const TYPES = [
  { value: 'website', label: 'Website', icon: Globe, text: 'Multi-page marketing or content site.' },
  { value: 'saas', label: 'SaaS', icon: Boxes, text: 'Software product with marketing pages.' },
  { value: 'ecommerce', label: 'E-commerce', icon: ShoppingBag, text: 'Online store and product catalogue.' },
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, text: 'Data-heavy product or admin UI.' },
  { value: 'landing', label: 'Landing Page', icon: LayoutTemplate, text: 'Single page focused on conversion.' },
  { value: 'internal_tool', label: 'Internal Tool', icon: Wrench, text: 'Tools for your own team.' },
] as const

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #2563EB.')
const schema = z.object({
  name: z.string().trim().min(2, 'Name must have at least 2 characters.').max(120),
  description: z.string().max(2000),
  slug: z.string().trim().min(1, 'Slug is required.').max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens.'),
  project_type: z.enum(['website', 'saas', 'ecommerce', 'dashboard', 'landing', 'internal_tool']),
  template: z.enum(['blank', 'saas_dashboard', 'ecommerce', 'landing', 'portfolio']),
  primary: hex,
  secondary: hex,
  font: z.enum(FONTS),
})
type Values = z.infer<typeof schema>

const STEPS = [
  { title: 'Project Information', fields: ['name', 'description', 'slug'] as const },
  { title: 'Project Type', fields: ['project_type'] as const },
  { title: 'Template', fields: ['template'] as const },
  { title: 'Branding', fields: ['primary', 'secondary', 'font'] as const },
  { title: 'Create Project', fields: [] as const },
]

export default function CreateProjectPage() {
  const { workspace } = useCurrentWorkspace()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const [step, setStep] = useState(0)
  const [slugTouched, setSlugTouched] = useState(false)
  const [logo, setLogo] = useState<File | null>(null)
  const initialTemplate = (TEMPLATES.find((t) => t.key === params.get('template'))?.key ?? 'blank') as Values['template']
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      name: '', description: '', slug: '', project_type: initialTemplate === 'ecommerce' ? 'ecommerce' : initialTemplate === 'landing' ? 'landing' : initialTemplate === 'saas_dashboard' ? 'saas' : 'website',
      template: initialTemplate, primary: '#2563EB', secondary: '#7C3AED', font: 'Inter',
    },
  })
  const values = useWatch({ control: form.control })
  const { errors, isSubmitting } = form.formState
  const logoUrl = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo])
  useEffect(() => () => void (logoUrl && URL.revokeObjectURL(logoUrl)), [logoUrl])

  if (!canContribute(workspace))
    return <EmptyState title="Viewers cannot create projects" description="Ask a workspace admin for a contributor role." />

  const next = async () => {
    const ok = await form.trigger(STEPS[step].fields as unknown as (keyof Values)[])
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const submit = form.handleSubmit(async (v) => {
    try {
      const project = await projectApi.create({
        workspace: workspace!.id,
        name: v.name,
        description: v.description,
        slug: v.slug,
        project_type: v.project_type,
        template: v.template,
        branding: { primary: v.primary, secondary: v.secondary, font: v.font },
      })
      if (logo) {
        const fd = new FormData()
        fd.append('logo', logo)
        await projectApi.update(project.id, fd).catch(() => toast.warning('Project created, but the logo could not be uploaded.'))
      }
      await qc.invalidateQueries({ queryKey: ['projects'] })
      await qc.invalidateQueries({ queryKey: ['workspaces'] })
      toast.success(`${project.name} created`)
      navigate(`/app/projects/${project.id}`)
    } catch (e) {
      applyServerErrors(e, form.setError, ['name', 'slug', 'description'])
      if (form.getFieldState('name').error || form.getFieldState('slug').error) setStep(0)
    }
  })

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Create a new project</h1>
      <p className="mt-1 text-sm text-muted">Set up the basics — you can change everything later.</p>

      <ol className="my-8 grid grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col gap-2">
            <div className={cn('h-1.5 rounded-full transition-colors', i <= step ? 'bg-brand-gradient' : 'bg-hover')} />
            <span className={cn('hidden text-xs sm:block', i === step ? 'font-medium text-fg' : 'text-muted')} aria-current={i === step ? 'step' : undefined}>
              {i + 1}. {s.title}
            </span>
          </li>
        ))}
      </ol>

      <Card className="p-6">
        <h2 className="mb-5 font-display text-lg font-semibold">
          Step {step + 1}: {STEPS[step].title}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step === STEPS.length - 1) void submit()
            else void next()
          }}
          noValidate
        >
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Project name" htmlFor="name" error={errors.name?.message}>
                <Input
                  id="name"
                  autoFocus
                  aria-invalid={!!errors.name}
                  {...form.register('name', {
                    onChange: (e) => !slugTouched && form.setValue('slug', slugify(e.target.value), { shouldValidate: !!values.slug }),
                  })}
                />
              </Field>
              <Field label="Description" htmlFor="description" error={errors.description?.message}>
                <Textarea id="description" rows={3} placeholder="What are you building?" {...form.register('description')} />
              </Field>
              <Field label="Slug" htmlFor="slug" error={errors.slug?.message} hint="Used in URLs. Lowercase letters, numbers and hyphens.">
                <Input id="slug" aria-invalid={!!errors.slug} {...form.register('slug', { onChange: () => setSlugTouched(true) })} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div role="radiogroup" aria-label="Project type" className="grid gap-3 sm:grid-cols-2">
              {TYPES.map(({ value, label, icon: Icon, text }) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={values.project_type === value}
                  key={value}
                  onClick={() => form.setValue('project_type', value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer',
                    values.project_type === value ? 'border-brand-blue bg-brand-blue/10' : 'border-line hover:bg-hover',
                  )}
                >
                  <Icon className="mt-0.5 size-5 text-brand-blue" />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="text-sm text-muted">{text}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div role="radiogroup" aria-label="Template" className="grid gap-3 sm:grid-cols-2">
              {TEMPLATES.map(({ key, name, description, icon: Icon, pages, colors }) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={values.template === key}
                  key={key}
                  onClick={() => form.setValue('template', key)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-colors cursor-pointer',
                    values.template === key ? 'border-brand-blue bg-brand-blue/10' : 'border-line hover:bg-hover',
                  )}
                >
                  <div className="mb-3 flex h-16 items-center justify-center rounded-lg" style={{ background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})` }}>
                    <Icon className="size-6 text-white" />
                  </div>
                  <span className="block font-medium">{name}</span>
                  <span className="text-sm text-muted">{description}</span>
                  <span className="mt-2 block text-xs text-muted">Pages: {pages.join(', ')}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                {(['primary', 'secondary'] as const).map((k) => (
                  <Field key={k} label={k === 'primary' ? 'Primary color' : 'Secondary color'} htmlFor={k} error={errors[k]?.message}>
                    <div className="flex gap-2">
                      <input type="color" aria-label={`${k} color picker`} value={values[k]} onChange={(e) => form.setValue(k, e.target.value.toUpperCase(), { shouldValidate: true })} className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1" />
                      <Input id={k} {...form.register(k)} />
                    </div>
                  </Field>
                ))}
                <Field label="Font" htmlFor="font">
                  <Select id="font" {...form.register('font')}>
                    {FONTS.map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Logo" htmlFor="logo" hint="Optional. PNG, JPEG, WebP or GIF up to 5 MB.">
                  <label htmlFor="logo" className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 text-sm text-muted hover:bg-hover">
                    <Upload className="size-4" /> {logo ? logo.name : 'Choose image…'}
                  </label>
                  <input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (f && f.size > 5 * 1024 * 1024) return toast.error('Logo must be smaller than 5 MB.')
                      setLogo(f)
                    }}
                  />
                </Field>
              </div>
              <div className="rounded-xl border border-line p-4" aria-label="Brand preview">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
                <div className="mt-3 rounded-lg bg-white p-5 text-slate-900" style={{ fontFamily: values.font }}>
                  <div className="flex items-center gap-2">
                    {logoUrl ? <img src={logoUrl} alt="" className="size-7 rounded object-cover" /> : <span className="size-7 rounded" style={{ background: values.primary }} />}
                    <span className="font-bold">{values.name || 'Your project'}</span>
                  </div>
                  <p className="mt-4 text-xl font-bold">Build something people love</p>
                  <p className="mt-1 text-sm text-slate-500">A short sentence that explains your product.</p>
                  <div className="mt-4 flex gap-2">
                    <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white" style={{ background: values.primary }}>
                      Get started
                    </span>
                    <span className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: values.secondary, color: values.secondary }}>
                      Learn more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Name', values.name],
                ['Slug', values.slug],
                ['Type', TYPES.find((t) => t.value === values.project_type)?.label],
                ['Template', TEMPLATES.find((t) => t.key === values.template)?.name],
                ['Font', values.font],
                ['Logo', logo?.name ?? 'None'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-line p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v || '—'}</dd>
                </div>
              ))}
              <div className="rounded-xl border border-line p-3 sm:col-span-2">
                <dt className="text-xs text-muted">Colors</dt>
                <dd className="mt-2 flex gap-2">
                  <span className="size-6 rounded-md" style={{ background: values.primary }} title={values.primary} />
                  <span className="size-6 rounded-md" style={{ background: values.secondary }} title={values.secondary} />
                </dd>
              </div>
              {values.description && <p className="text-sm text-muted sm:col-span-2">{values.description}</p>}
            </dl>
          )}

          <div className="mt-8 flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
              <ArrowLeft /> {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="submit">
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button type="submit" variant="gradient" loading={isSubmitting}>
                <Rocket /> Create Project
              </Button>
            )}
          </div>
        </form>
      </Card>
      {step === 4 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Check className="size-3.5 text-emerald-500" /> Pages, theme and starter content will be generated from the template.
        </p>
      )}
    </div>
  )
}
