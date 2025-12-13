/**
 * Colored Toggle Widget
 *
 * Toggle switch with configurable colors for different states.
 */

import type { FieldWidgetProps } from '@character-foundry/app-framework';

interface ColoredToggleHint {
  color?: 'blue' | 'red' | 'green' | 'purple' | 'orange';
  badge?: string;
}

const colorClasses: Record<
  string,
  { ring: string; bg: string; badge: string }
> = {
  blue: {
    ring: 'peer-focus:ring-blue-500',
    bg: 'peer-checked:bg-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  red: {
    ring: 'peer-focus:ring-red-500',
    bg: 'peer-checked:bg-red-500',
    badge: 'bg-red-500/20 text-red-400',
  },
  green: {
    ring: 'peer-focus:ring-green-500',
    bg: 'peer-checked:bg-green-500',
    badge: 'bg-green-500/20 text-green-400',
  },
  purple: {
    ring: 'peer-focus:ring-purple-500',
    bg: 'peer-checked:bg-purple-500',
    badge: 'bg-purple-500/20 text-purple-400',
  },
  orange: {
    ring: 'peer-focus:ring-orange-500',
    bg: 'peer-checked:bg-orange-500',
    badge: 'bg-orange-500/20 text-orange-400',
  },
};

export function ColoredToggle({
  value,
  onChange,
  name,
  hint,
}: FieldWidgetProps<boolean>) {
  const extHint = hint as (typeof hint & ColoredToggleHint) | undefined;
  const color = extHint?.color || 'blue';
  const classes = colorClasses[color] || colorClasses.blue;

  return (
    <div className={hint?.className} data-field={name}>
      <div className="flex items-center justify-between">
        <div>
          <span className="font-semibold flex items-center gap-2">
            {hint?.label}
            {extHint?.badge && (
              <span className={`px-2 py-0.5 ${classes.badge} text-xs rounded`}>
                {extHint.badge}
              </span>
            )}
          </span>
          {hint?.helperText && (
            <p className="text-sm text-dark-muted mt-1">{hint.helperText}</p>
          )}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={value ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div
            className={`w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 ${classes.ring} rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${classes.bg}`}
          />
        </label>
      </div>
    </div>
  );
}
