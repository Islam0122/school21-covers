import { CallToAction } from '@/features/marketing/sections'

export default function AboutPage() {
  return (
    <>
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">About WebMindClub</h1>
        <p className="mt-6 text-lg text-muted">
          WebMindClub helps teams turn ideas into digital products — from concept and design to a working MVP and launch.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            ['Create', 'Shape the idea, the brand and the structure of your product.'],
            ['Develop', 'Design pages, plan tasks and collaborate with your team.'],
            ['Launch', 'Preview every device and publish versioned releases.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-card border border-line bg-surface p-5">
              <h2 className="font-display font-semibold text-gradient">{t}</h2>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted">
          Contact details on this site are demonstration placeholders.
        </p>
      </section>
      <CallToAction />
    </>
  )
}
