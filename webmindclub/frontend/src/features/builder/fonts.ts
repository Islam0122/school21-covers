const loaded = new Set<string>(['Inter', 'Manrope'])
const ALLOWED = new Set(['Inter', 'Manrope', 'Poppins', 'Space Grotesk', 'DM Sans', 'Playfair Display', 'Lora', 'Roboto'])

/** Loads allow-listed Google Fonts on demand for rendered sites. */
export function ensureFonts(...families: string[]) {
  for (const family of families) {
    if (!ALLOWED.has(family) || loaded.has(family)) continue
    loaded.add(family)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700;800&display=swap`
    document.head.appendChild(link)
  }
}
