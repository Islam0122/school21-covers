import { useEffect, useState } from 'react'
import type { Device } from '@/types'

const detect = (): Device => (window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop')

export function useDevice() {
  const [device, setDevice] = useState<Device>(detect)
  useEffect(() => {
    const onResize = () => setDevice(detect())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return device
}
