import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/app'
import { applyAppearance, useUi } from './stores/ui'
import './index.css'

applyAppearance(useUi.getState().appearance)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
