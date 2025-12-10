/**
 * ComfyUI Bridge Extension Code
 *
 * This is the JavaScript code that users need to install in their ComfyUI instance
 * to enable cross-origin communication with Character Architect.
 *
 * Installation: Copy to ComfyUI/web/extensions/character_architect_bridge.js
 */

export const COMFY_BRIDGE_EXTENSION_CODE = `// Character Architect Bridge Extension
// =====================================
// This extension enables Character Architect to capture generated images.
//
// Installation:
// 1. Save this file as: ComfyUI/web/extensions/character_architect_bridge.js
// 2. Restart ComfyUI
//
// The extension will automatically send image data to Character Architect
// when images are generated.

import { app } from "../../scripts/app.js";

app.registerExtension({
  name: "CharacterArchitect.Bridge",

  async setup() {
    // Listen for execution complete events
    api.addEventListener("executed", (event) => {
      const { detail } = event;

      // Only process if we have image output
      if (!detail?.output?.images) return;

      // Send each generated image to the parent window (Character Architect)
      for (const image of detail.output.images) {
        window.parent.postMessage({
          type: 'COMFY_GENERATION_COMPLETE',
          payload: {
            filename: image.filename,
            subfolder: image.subfolder || '',
            type: image.type || 'output'
          }
        }, '*');
      }
    });

    console.log('[CharacterArchitect] Bridge extension loaded - images will be sent to parent window');
  }
});
`;

export const COMFY_BRIDGE_FILENAME = 'character_architect_bridge.js';
export const COMFY_BRIDGE_PATH = 'ComfyUI/web/extensions/character_architect_bridge.js';
