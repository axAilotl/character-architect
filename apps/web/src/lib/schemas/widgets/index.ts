/**
 * Custom Widgets Index
 *
 * Registers custom widgets with the app-framework widget registry.
 */

import { widgetRegistry, type WidgetComponent } from '@character-foundry/character-foundry/app-framework';
import { ThemeSelector } from './ThemeSelector';
import { ColoredToggle } from './ColoredToggle';
import { BackgroundUpload } from './BackgroundUpload';

/**
 * Register all custom widgets with the app-framework.
 * Call this once during app initialization.
 */
export function registerCustomWidgets() {
  widgetRegistry.registerWidget({
    id: 'theme-selector',
    name: 'Theme Selector',
    component: ThemeSelector as WidgetComponent,
    description: 'Grid of theme cards with color previews',
  });

  widgetRegistry.registerWidget({
    id: 'colored-toggle',
    name: 'Colored Toggle',
    component: ColoredToggle as WidgetComponent,
    description: 'Toggle switch with configurable color',
  });

  widgetRegistry.registerWidget({
    id: 'background-upload',
    name: 'Background Upload',
    component: BackgroundUpload as WidgetComponent,
    description: 'Image upload with preview and server storage',
  });
}

// Export individual widgets for direct use
export { ThemeSelector, ColoredToggle, BackgroundUpload };
