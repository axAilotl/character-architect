import { useSettingsStore, THEMES } from '../../../store/settings-store';

export function ThemeSettingsPanel() {
  const {
    theme,
    setTheme,
    setCustomCss,
    setBackgroundImage,
    setUseCardAsBackground,
  } = useSettingsStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Theme Settings</h3>
        <p className="text-dark-muted">
          Customize the look and feel of the application.
        </p>
      </div>

      {/* Theme Selector */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Color Theme</h4>
        <p className="text-sm text-dark-muted">
          Choose from built-in color schemes.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className={`p-3 rounded-lg border transition-all text-left ${theme.themeId === t.id
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-dark-border hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Color preview */}
                <div className="flex gap-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: t.colors.bg }}
                    title="Background"
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: t.colors.surface }}
                    title="Surface"
                  />
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: t.colors.accent }}
                    title="Accent"
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

      {/* Background Image */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Background Image</h4>
        <p className="text-sm text-dark-muted">
          Upload a custom background image for the editor area.
        </p>

        <div className="space-y-3">
          {/* Preview current background */}
          {theme.backgroundImage && (
            <div className="relative">
              <img
                src={theme.backgroundImage}
                alt="Background preview"
                className="w-full h-32 object-cover rounded border border-dark-border"
              />
              <button
                onClick={async () => {
                  // If it's a server URL, try to delete the file
                  if (theme.backgroundImage.startsWith('/api/settings/theme/images/')) {
                    const filename = theme.backgroundImage.split('/').pop();
                    if (filename) {
                      await fetch(`/api/settings/theme/images/${filename}`, { method: 'DELETE' });
                    }
                  }
                  setBackgroundImage('');
                }}
                className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium mb-1 block">Upload Image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                // Upload to server
                const formData = new FormData();
                formData.append('file', file);

                try {
                  const response = await fetch('/api/settings/theme/background', {
                    method: 'POST',
                    body: formData,
                  });

                  if (response.ok) {
                    const result = await response.json();
                    setBackgroundImage(result.url);
                  } else {
                    const err = await response.json();
                    alert(err.error || 'Failed to upload image');
                  }
                } catch (err) {
                  alert('Failed to upload image');
                }

                e.target.value = ''; // Reset for re-upload
              }}
              className="w-full text-sm text-dark-text file:mr-3 file:rounded file:border-0 file:px-3 file:py-2 file:bg-blue-600 file:text-white file:cursor-pointer"
            />
          </label>
          <p className="text-xs text-dark-muted">
            Supports PNG, JPG, WebP, GIF. Image is stored on the server.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useCardAsBackground"
            checked={theme.useCardAsBackground}
            onChange={(e) => setUseCardAsBackground(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="useCardAsBackground" className="text-sm font-medium">
            Use character card as background
          </label>
        </div>
        <p className="text-xs text-dark-muted">
          When editing a card, use its avatar as a blurred background overlay at 40% opacity.
        </p>
      </div>

      {/* Custom CSS */}
      <div className="border border-dark-border rounded-lg p-6 space-y-4">
        <h4 className="font-semibold">Custom CSS</h4>
        <p className="text-sm text-dark-muted">
          Add custom CSS to further customize the appearance.
        </p>

        <details className="text-sm">
          <summary className="cursor-pointer text-blue-400 hover:text-blue-300">
            Available CSS Variables
          </summary>
          <div className="mt-2 p-3 bg-dark-bg rounded border border-dark-border font-mono text-xs">
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

        <textarea
          value={theme.customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          placeholder="/* Your custom CSS here */\n:root {
  --color-accent: #ff00ff;
}"
          rows={8}
          className="w-full bg-dark-card border border-dark-border rounded px-3 py-2 font-mono text-sm resize-none"
        />
      </div>
    </div>
  );
}
