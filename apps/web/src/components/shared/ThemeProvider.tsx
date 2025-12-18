/**
 * ThemeProvider - Handles dynamic theme switching and custom CSS
 */

import { useEffect } from 'react';
import { useSettingsStore, THEMES } from '../../store/settings-store';
import { useCardStore } from '../../store/card-store';
import { getDeploymentConfig } from '../../config/deployment';
import { localDB } from '../../lib/db';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useSettingsStore();
  const { currentCard } = useCardStore();

  // Apply theme CSS variables
  useEffect(() => {
    const themeConfig = THEMES.find((t) => t.id === theme.themeId) || THEMES[0];
    const root = document.documentElement;

    root.style.setProperty('--color-bg', themeConfig.colors.bg);
    root.style.setProperty('--color-surface', themeConfig.colors.surface);
    root.style.setProperty('--color-border', themeConfig.colors.border);
    root.style.setProperty('--color-text', themeConfig.colors.text);
    root.style.setProperty('--color-muted', themeConfig.colors.muted);
    root.style.setProperty('--color-accent', themeConfig.colors.accent);
    root.style.setProperty('--color-accent-hover', themeConfig.colors.accentHover);

    // Set dark mode class
    if (themeConfig.isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme.themeId]);

  // Apply custom CSS
  useEffect(() => {
    let styleEl = document.getElementById('custom-theme-css') as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'custom-theme-css';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = theme.customCss;

    return () => {
      // Cleanup handled by React
    };
  }, [theme.customCss]);

  // Apply background image CSS variable for the content area
  useEffect(() => {
    const root = document.documentElement;

    if (theme.backgroundImage) {
      root.style.setProperty('--theme-bg-image', `url(${theme.backgroundImage})`);
    } else {
      root.style.removeProperty('--theme-bg-image');
    }
  }, [theme.backgroundImage]);

  // Apply card background image CSS variable
  useEffect(() => {
    const root = document.documentElement;

    if (!theme.useCardAsBackground || !currentCard) {
      root.style.removeProperty('--card-bg-image');
      return;
    }

    const loadCardBackground = async () => {
      const config = getDeploymentConfig();

      if (config.mode === 'light' || config.mode === 'static') {
        // Light/static mode: load from IndexedDB
        const imageData = await localDB.getImage(currentCard.meta.id, 'icon');
        if (imageData) {
          root.style.setProperty('--card-bg-image', `url(${imageData})`);
        } else {
          root.style.removeProperty('--card-bg-image');
        }
      } else {
        // Full mode: use API URL
        const cardImageUrl = `/api/cards/${currentCard.meta.id}/image`;
        root.style.setProperty('--card-bg-image', `url(${cardImageUrl})`);
      }
    };

    loadCardBackground();
  }, [theme.useCardAsBackground, currentCard]);

  return <>{children}</>;
}
