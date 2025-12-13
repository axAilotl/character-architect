/**
 * General Settings Schema
 *
 * Zod schema for general application settings.
 */

import { z } from 'zod';
import type { UIHints, FieldWidgetProps } from '@character-foundry/app-framework';
import { ColoredToggle } from '../widgets/ColoredToggle';
import type { ComponentType } from 'react';

export const generalSettingsSchema = z.object({
  linkedImageArchivalEnabled: z
    .boolean()
    .default(false)
    .describe('Archive external images as local assets'),
});

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;

export const generalSettingsUiHints: UIHints<GeneralSettings> = {
  linkedImageArchivalEnabled: {
    label: 'Linked Image Archival',
    helperText:
      'Archive external images from first message and alternate greetings as local assets. Original URLs are preserved for export.',
    widget: ColoredToggle as ComponentType<FieldWidgetProps<unknown>>,
    // Extended hint for custom widget
    color: 'red',
    badge: 'Destructive',
  } as UIHints<GeneralSettings>['linkedImageArchivalEnabled'] & { color?: string; badge?: string },
};
