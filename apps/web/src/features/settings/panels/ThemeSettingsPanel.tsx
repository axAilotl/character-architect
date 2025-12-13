import { AutoForm } from '@character-foundry/app-framework';
import { useSettingsStore } from '../../../store/settings-store';
import {
  themeSettingsSchema,
  themeSettingsUiHints,
  type ThemeSettings,
} from '../../../lib/schemas/settings/theme';

export function ThemeSettingsPanel() {
  const { theme, setTheme, setCustomCss, setBackgroundImage, setUseCardAsBackground } =
    useSettingsStore();

  const values: ThemeSettings = {
    themeId: theme.themeId,
    customCss: theme.customCss,
    backgroundImage: theme.backgroundImage,
    useCardAsBackground: theme.useCardAsBackground,
  };

  const handleChange = (updated: ThemeSettings) => {
    if (updated.themeId !== theme.themeId) {
      setTheme(updated.themeId);
    }
    if (updated.customCss !== theme.customCss) {
      setCustomCss(updated.customCss);
    }
    if (updated.backgroundImage !== theme.backgroundImage) {
      setBackgroundImage(updated.backgroundImage);
    }
    if (updated.useCardAsBackground !== theme.useCardAsBackground) {
      setUseCardAsBackground(updated.useCardAsBackground);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Theme Settings</h3>
        <p className="text-dark-muted">
          Customize the look and feel of the application.
        </p>
      </div>

      <div className="border border-dark-border rounded-lg p-6">
        <AutoForm
          schema={themeSettingsSchema}
          values={values}
          onChange={handleChange}
          uiHints={themeSettingsUiHints}
        />
      </div>

      {/* CSS Variables Reference */}
      <details className="text-sm border border-dark-border rounded-lg p-4">
        <summary className="cursor-pointer text-blue-400 hover:text-blue-300 font-medium">
          Available CSS Variables
        </summary>
        <div className="mt-3 p-3 bg-dark-bg rounded border border-dark-border font-mono text-xs">
          <pre className="whitespace-pre-wrap">
{`--color-bg         /* Main background */
--color-surface    /* Surface/card background */
--color-border     /* Border color */
--color-text       /* Primary text */
--color-muted      /* Muted text */
--color-accent     /* Accent/primary color */
--color-accent-hover /* Accent hover state */

/* Classes: */
.theme-bg, .theme-surface, .theme-border
.theme-text, .theme-muted
.btn-primary, .btn-secondary, .btn-danger
.card, .label, .chip`}
          </pre>
        </div>
      </details>
    </div>
  );
}
