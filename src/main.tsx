import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './StudioApp';
import './styles.css';
import './studio.css';
import './portfolio.css';
const container = document.getElementById('root');
if (container) {
    createRoot(container).render(<React.StrictMode>
      <App />
    </React.StrictMode>);
}
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const register = () => { navigator.serviceWorker.register('/sw.js').catch(() => { }); };
    if (document.readyState === 'complete')
        register();
    else
        window.addEventListener('load', register, { once: true });
}
