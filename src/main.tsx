import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PosStoreProvider } from './context/PosStore'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles.css'

if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>undefined))

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><PosStoreProvider><App/></PosStoreProvider></ErrorBoundary></StrictMode>)
