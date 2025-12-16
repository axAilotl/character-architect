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

  // Render error state using DOM APIs to avoid XSS
  const root = document.getElementById('root');
  if (root) {
    const container = document.createElement('div');
    container.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #f1f5f9; font-family: system-ui;';

    const inner = document.createElement('div');
    inner.style.cssText = 'text-align: center; padding: 2rem;';

    const heading = document.createElement('h1');
    heading.style.cssText = 'font-size: 1.5rem; margin-bottom: 1rem;';
    heading.textContent = 'Failed to start Character Architect';

    const message = document.createElement('p');
    message.style.color = '#94a3b8';
    message.textContent = err?.message || 'Unknown error';

    const button = document.createElement('button');
    button.style.cssText = 'margin-top: 1rem; padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.25rem; cursor: pointer;';
    button.textContent = 'Retry';
    button.addEventListener('click', () => location.reload());

    inner.appendChild(heading);
    inner.appendChild(message);
    inner.appendChild(button);
    container.appendChild(inner);

    root.innerHTML = '';
    root.appendChild(container);
  }
});
