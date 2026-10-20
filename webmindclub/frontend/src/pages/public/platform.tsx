import { CallToAction, FeatureGrid, HowItWorks } from '@/features/marketing/sections'

export default function PlatformPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-20 text-center sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          The <span className="text-gradient">WebMindClub</span> platform
        </h1>
        <p className="mt-5 text-lg text-muted">
          A connected workspace for product teams: plan, design and ship websites and apps without switching tools.
        </p>
      </section>
      <FeatureGrid title="Built for the whole product lifecycle" />
      <HowItWorks />
      <CallToAction />
    </>
  )
}
