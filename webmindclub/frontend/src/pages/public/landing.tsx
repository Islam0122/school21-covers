import { CallToAction, FeatureGrid, FeaturedProject, Hero, HowItWorks } from '@/features/marketing/sections'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <FeatureGrid id="platform" />
      <FeaturedProject />
      <HowItWorks />
      <CallToAction />
    </>
  )
}
