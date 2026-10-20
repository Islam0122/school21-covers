import { CallToAction, FeaturedProject } from '@/features/marketing/sections'

export default function ShowcasePage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-20 text-center sm:px-6">
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Our projects</h1>
        <p className="mt-5 text-lg text-muted">Products designed, built and launched with WebMindClub.</p>
      </section>
      <FeaturedProject />
      <CallToAction />
    </>
  )
}
