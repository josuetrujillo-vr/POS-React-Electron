import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

/**
 * Entry point del proceso renderer (React).
 * Monta la aplicación en el elemento root del HTML.
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
