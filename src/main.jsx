import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './css/variables.css'
import './css/main.css'
import './css/dashboard.css'
import './css/components.css'
import './css/enterprise.css'
import './css/refinement.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}
