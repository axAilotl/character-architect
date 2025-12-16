/**
 * Theme Selector Widget
 *
 * Custom widget for selecting a theme from a grid of theme cards.
 */

import type { FieldWidgetProps } from '@character-foundry/character-foundry/app-framework';
import { THEMES } from '../../../store/settings-store';

export function ThemeSelector({
  value,
  onChange,
  name,
  hint,
}: FieldWidgetProps<string>) {
  return (
    <div className={hint?.className} data-field={name}>
      {hint?.label && (
        <label className="block text-sm font-medium mb-2">{hint.label}</label>
      )}
      {hint?.helperText && (
        <p className="text-sm text-dark-muted mb-3">{hint.helperText}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`p-3 rounded-lg border transition-all text-left ${
              value === t.id
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-dark-border hover:border-blue-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: t.colors.bg }}
                />
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: t.colors.surface }}
                />
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: t.colors.accent }}
                />
              </div>
              <div>
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-dark-muted">
                  {t.isDark ? 'Dark' : 'Light'}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
