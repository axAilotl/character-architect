/**
 * Theme Settings Schema
 *
 * Zod schema for theme and visual settings.
 */

import { z } from 'zod';
import type { UIHints, FieldWidgetProps } from '@character-foundry/app-framework';
import { ThemeSelector } from '../widgets/ThemeSelector';
import { BackgroundUpload } from '../widgets/BackgroundUpload';
import type { ComponentType } from 'react';

export const themeIdSchema = z.enum([
  'default-dark',
  'bisexual',
  'necron',
  'dracula',
  'sakura',
  'solarized-light',
  'github-light',
  'nord-light',
]);

export const themeSettingsSchema = z.object({
  themeId: themeIdSchema.default('default-dark').describe('Color theme'),
  customCss: z.string().default('').describe('Custom CSS overrides'),
  backgroundImage: z.string().default('').describe('Background image URL'),
  useCardAsBackground: z
    .boolean()
    .default(false)
    .describe('Use character card avatar as background'),
});

export type ThemeSettings = z.infer<typeof themeSettingsSchema>;
export type ThemeId = z.infer<typeof themeIdSchema>;

export const themeSettingsUiHints: UIHints<ThemeSettings> = {
  themeId: {
    widget: ThemeSelector as ComponentType<FieldWidgetProps<unknown>>,
    label: 'Color Theme',
    helperText: 'Choose from built-in color schemes.',
  },
  customCss: {
    widget: 'textarea',
    label: 'Custom CSS',
    rows: 8,
    placeholder:
      '/* Your custom CSS here */\n:root {\n  --color-accent: #ff00ff;\n}',
    helperText: 'Add custom CSS to further customize the appearance.',
  },
  backgroundImage: {
    widget: BackgroundUpload as ComponentType<FieldWidgetProps<unknown>>,
    label: 'Background Image',
    helperText: 'Upload a custom background image for the editor area.',
  },
  useCardAsBackground: {
    widget: 'switch',
    label: 'Use character card as background',
    helperText:
      'When editing a card, use its avatar as a blurred background overlay at 40% opacity.',
  },
};
