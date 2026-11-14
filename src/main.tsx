import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker
    .getRegistrations()
    .then(async (regs) => {
      if (regs.length === 0) return;
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => [] as string[]);
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
      if (hadController) {
        try {
          if (!window.sessionStorage.getItem('tpm_dev_sw_cleaned')) {
            window.sessionStorage.setItem('tpm_dev_sw_cleaned', '1');
            window.location.reload();
          }
        } catch {
          // Ignore storage restrictions
        }
      }
    })
    .catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
