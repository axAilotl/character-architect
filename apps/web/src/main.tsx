import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { initializeModules } from './lib/modules';
import { registerCustomWidgets } from './lib/schemas/widgets';
import './index.css';
import './styles/autoform.css';

/**
 * Bootstrap the application
 *
 * 1. Register custom widgets for app-framework
 * 2. Initialize all modules (core tabs + optional modules based on feature flags)
 * 3. Render the React application
 */
async function bootstrap() {
  // Register custom widgets with app-framework
  registerCustomWidgets();

  // Initialize modules before rendering
  await initializeModules();

  // Render the application
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Start the application
bootstrap().catch((err) => {
  console.error('[Bootstrap] Failed to start application:', err);

  // Render error state
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f1f5f9; font-family: system-ui;">
        <div style="text-align: center; padding: 2rem;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Failed to start Card Architect</h1>
          <p style="color: #94a3b8;">${err?.message || 'Unknown error'}</p>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">
            Retry
          </button>
        </div>
      </div>
    `;
  }
});
