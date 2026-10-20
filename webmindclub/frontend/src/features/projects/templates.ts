import { LayoutDashboard, LayoutTemplate, Briefcase, ShoppingBag, Square } from 'lucide-react'

/** Mirrors backend `builder/templates_library.py` (the server builds the actual pages). */
export const TEMPLATES = [
  { key: 'blank', name: 'Blank Project', description: 'Start from an empty page and build freely.', icon: Square, pages: ['Home'], colors: ['#111827', '#6B7280'] },
  { key: 'saas_dashboard', name: 'SaaS Dashboard', description: 'Marketing site for a SaaS product with pricing and contact.', icon: LayoutDashboard, pages: ['Home', 'Pricing', 'Contact'], colors: ['#4F46E5', '#7C3AED'] },
  { key: 'ecommerce', name: 'E-commerce Store', description: 'Storefront with product grid and contact page.', icon: ShoppingBag, pages: ['Home', 'Products', 'Contact'], colors: ['#16A34A', '#F59E0B'] },
  { key: 'landing', name: 'Landing Page', description: 'One focused page: hero, features, pricing and FAQ.', icon: LayoutTemplate, pages: ['Home'], colors: ['#0EA5E9', '#2563EB'] },
  { key: 'portfolio', name: 'Portfolio', description: 'Showcase work, tell your story and get in touch.', icon: Briefcase, pages: ['Work', 'About', 'Contact'], colors: ['#111827', '#6B7280'] },
] as const

export type TemplateKey = (typeof TEMPLATES)[number]['key']

export const FONTS = ['Inter', 'Manrope', 'Poppins', 'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora', 'Roboto'] as const
