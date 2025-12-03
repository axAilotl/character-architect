/**
 * Web Import Userscript Generator
 *
 * Generates the Tampermonkey/Violentmonkey/Greasemonkey userscript
 * with the correct server address for the user's installation.
 *
 * ## Adding a New Site
 * 1. Add @match pattern for the new site
 * 2. Add site detection in detectSite()
 * 3. Add button injection in siteInjectors
 * 4. If site needs client-side data fetch, add handler in handleImport()
 */

import * as os from 'os';

/**
 * Get the network IP address of the server
 */
function getNetworkIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/**
 * Generate the userscript with correct server addresses
 *
 * @param requestHost - Host header from the request
 * @param apiPort - API server port
 * @param webPort - Web UI port
 * @returns Generated userscript as string
 */
export function generateUserscript(
  requestHost: string,
  apiPort: number,
  webPort: number
): string {
  // Determine hostname - prefer network IP over localhost
  let hostname = requestHost.split(':')[0];
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    !hostname.startsWith('192.168')
  ) {
    hostname = getNetworkIp();
  }

  const apiUrl = `http://${hostname}:${apiPort}/api`;
  const webUrl = `http://${hostname}:${webPort}`;

  return `// ==UserScript==
// @name         Card Architect - Web Import
// @namespace    https://card-architect.local
// @version      1.0.9
// @description  Send character cards from supported sites to Card Architect
// @author       Card Architect
// @match        https://chub.ai/characters/*
// @match        https://www.chub.ai/characters/*
// @match        https://venus.chub.ai/characters/*
// @match        https://app.wyvern.chat/characters/*
// @match        https://character-tavern.com/character/*
// @match        https://realm.risuai.net/character/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      ${hostname}
// @connect      localhost
// @connect      127.0.0.1
// ==/UserScript==

(function() {
    'use strict';

    // Configuration - auto-configured from your Card Architect server
    const DEFAULT_API_URL = '${apiUrl}';
    const BUTTON_STYLES = \`
        .ca-import-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 4px rgba(99, 102, 241, 0.3);
        }
        .ca-import-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(99, 102, 241, 0.4);
        }
        .ca-import-btn:active {
            transform: translateY(0);
        }
        .ca-import-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        .ca-import-btn svg {
            width: 16px;
            height: 16px;
        }
        .ca-toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-size: 14px;
            z-index: 999999;
            animation: ca-slide-in 0.3s ease;
            max-width: 400px;
        }
        .ca-toast.success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .ca-toast.error {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        .ca-toast.info {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        }
        .ca-toast a {
            color: white;
            text-decoration: underline;
        }
        @keyframes ca-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    \`;

    const IMPORT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    function getApiUrl() {
        return GM_getValue('cardArchitectApiUrl', DEFAULT_API_URL);
    }

    function setApiUrl(url) {
        GM_setValue('cardArchitectApiUrl', url);
    }

    function showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = \`ca-toast \${type}\`;
        toast.innerHTML = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'ca-slide-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = BUTTON_STYLES;
        document.head.appendChild(style);
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.className = 'ca-import-btn';
        btn.innerHTML = \`\${IMPORT_ICON} Send to Card Architect\`;
        btn.addEventListener('click', handleImport);
        return btn;
    }

    function detectSite() {
        const host = window.location.hostname;
        const path = window.location.pathname;

        if (host.includes('chub.ai')) {
            return { site: 'chub', id: extractChubId(path) };
        }
        if (host === 'app.wyvern.chat' && path.startsWith('/characters/')) {
            return { site: 'wyvern', id: path.split('/characters/')[1]?.split('/')[0] };
        }
        if (host === 'character-tavern.com' && path.startsWith('/character/')) {
            return { site: 'character_tavern', id: path.split('/character/')[1]?.split('/')[0] };
        }
        if (host === 'realm.risuai.net' && path.startsWith('/character/')) {
            return { site: 'risu', id: path.split('/character/')[1]?.split('/')[0] };
        }
        return null;
    }

    function extractChubId(path) {
        const match = path.match(/\\/characters\\/([^/]+\\/[^/]+)/);
        return match ? match[1] : null;
    }

    function getRisuDownloadInfo() {
        const downloadBtn = document.querySelector('a[href*="download"], button[data-format]');
        if (downloadBtn) {
            const href = downloadBtn.getAttribute('href') || '';
            if (href.includes('.charx') || href.includes('format=charx')) {
                return { format: 'charx' };
            }
        }
        return { format: 'auto' };
    }

    // Intercept Wyvern's download by hooking URL.createObjectURL
    function fetchWyvernPng() {
        return new Promise((resolve, reject) => {
            console.log('[CA] Setting up blob intercept...');

            const originalCreateObjectURL = URL.createObjectURL.bind(URL);
            let captured = false;

            URL.createObjectURL = function(blob) {
                const url = originalCreateObjectURL(blob);

                if (!captured && blob instanceof Blob && blob.type === 'image/png') {
                    console.log('[CA] Intercepted PNG blob:', blob.size, 'bytes');
                    captured = true;

                    URL.createObjectURL = originalCreateObjectURL;

                    const reader = new FileReader();
                    reader.onload = () => {
                        console.log('[CA] PNG captured, length:', reader.result.length);
                        resolve(reader.result);
                    };
                    reader.onerror = () => reject(new Error('Failed to read blob'));
                    reader.readAsDataURL(blob);
                }

                return url;
            };

            const findAndClickDownload = () => {
                const selectors = [
                    'button[aria-label*="download" i]',
                    'button[aria-label*="export" i]',
                    'a[download]',
                    'button:has(svg[data-icon="download"])',
                    '[data-testid*="download"]',
                ];

                for (const sel of selectors) {
                    const btn = document.querySelector(sel);
                    if (btn) {
                        console.log('[CA] Found download button:', sel);
                        btn.click();
                        return true;
                    }
                }

                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('download') || text.includes('export') || text.includes('png')) {
                        console.log('[CA] Found download button by text:', text);
                        btn.click();
                        return true;
                    }
                }

                return false;
            };

            let attempts = 0;
            const tryClick = () => {
                if (findAndClickDownload()) {
                    setTimeout(() => {
                        if (!captured) {
                            URL.createObjectURL = originalCreateObjectURL;
                            reject(new Error('Timeout waiting for PNG blob'));
                        }
                    }, 10000);
                } else if (++attempts < 10) {
                    setTimeout(tryClick, 500);
                } else {
                    URL.createObjectURL = originalCreateObjectURL;
                    reject(new Error('Could not find download button'));
                }
            };

            tryClick();
        });
    }

    // Fetch Wyvern gallery images via their image proxy
    async function fetchWyvernGalleryImages(characterId) {
        try {
            console.log('[CA] Fetching gallery data for', characterId);

            const apiResponse = await fetch(\`https://api.wyvern.chat/characters/\${characterId}\`);
            if (!apiResponse.ok) {
                console.log('[CA] Gallery API returned', apiResponse.status);
                return [];
            }

            const data = await apiResponse.json();
            const gallery = data.gallery || [];

            if (gallery.length === 0) {
                console.log('[CA] No gallery images found');
                return [];
            }

            console.log('[CA] Found', gallery.length, 'gallery images');

            const galleryImages = [];
            for (const img of gallery) {
                if (!img.imageURL) continue;

                try {
                    console.log('[CA] Fetching gallery image:', img.type, img.title);
                    const proxyUrl = \`https://app.wyvern.chat/api/image-proxy?url=\${encodeURIComponent(img.imageURL)}\`;
                    const proxyResponse = await fetch(proxyUrl, { credentials: 'include' });

                    if (!proxyResponse.ok) {
                        console.log('[CA] Proxy returned', proxyResponse.status, 'for', img.title);
                        continue;
                    }

                    const proxyData = await proxyResponse.json();
                    if (proxyData.image) {
                        galleryImages.push({
                            type: img.type || 'other',
                            title: img.title || 'gallery',
                            base64: proxyData.image
                        });
                        console.log('[CA] Captured gallery image:', img.title, proxyData.image.length, 'chars');
                    }
                } catch (imgErr) {
                    console.error('[CA] Failed to fetch gallery image:', img.title, imgErr);
                }
            }

            return galleryImages;
        } catch (err) {
            console.error('[CA] Failed to fetch gallery:', err);
            return [];
        }
    }

    async function handleImport(e) {
        const btn = e.target.closest('.ca-import-btn');
        if (!btn || btn.disabled) return;

        const siteInfo = detectSite();
        if (!siteInfo || !siteInfo.id) {
            showToast('Could not detect character ID from URL', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = \`\${IMPORT_ICON} Importing...\`;

        try {
            const apiUrl = getApiUrl();
            const payload = {
                url: window.location.href,
                site: siteInfo.site,
                characterId: siteInfo.id
            };

            if (siteInfo.site === 'risu') {
                const downloadInfo = getRisuDownloadInfo();
                payload.format = downloadInfo.format;
            }

            // Wyvern needs client-side fetch
            if (siteInfo.site === 'wyvern') {
                btn.innerHTML = \`\${IMPORT_ICON} Fetching PNG...\`;
                payload.pngData = await fetchWyvernPng();

                btn.innerHTML = \`\${IMPORT_ICON} Fetching gallery...\`;
                const galleryImages = await fetchWyvernGalleryImages(siteInfo.id);
                if (galleryImages.length > 0) {
                    payload.clientData = { galleryImages };
                    console.log('[CA] Sending', galleryImages.length, 'gallery images');
                }
            }

            const response = await gmFetch(\`\${apiUrl}/web-import\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = JSON.parse(response);

            if (result.success) {
                const cardUrl = \`${webUrl}/#/cards/\${result.cardId}\`;
                showToast(
                    \`Successfully imported "\${result.name}"!<br><a href="\${cardUrl}" target="_blank">Open in Card Architect</a>\`,
                    'success',
                    8000
                );
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (err) {
            console.error('Card Architect import error:', err);
            showToast(\`Import failed: \${err.message}\`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = \`\${IMPORT_ICON} Send to Card Architect\`;
        }
    }

    function gmFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: url,
                headers: options.headers || {},
                data: options.body,
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(\`HTTP \${response.status}: \${response.statusText}\`));
                    }
                },
                onerror: (error) => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    }

    const siteInjectors = {
        chub: () => {
            const observer = new MutationObserver((mutations, obs) => {
                const actionArea = document.querySelector('.flex.gap-2, [class*="actions"], [class*="buttons"]');
                if (actionArea && !document.querySelector('.ca-import-btn')) {
                    actionArea.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const fallback = document.querySelector('main, article, .container') || document.body;
                    const btn = createButton();
                    btn.style.position = 'fixed';
                    btn.style.top = '80px';
                    btn.style.right = '20px';
                    btn.style.zIndex = '9999';
                    fallback.appendChild(btn);
                }
            }, 3000);
        },

        wyvern: () => {
            const observer = new MutationObserver((mutations, obs) => {
                const actionArea = document.querySelector('body > div > main > div > div > div > div > div > div.lg\\\\:col-span-1 > div > div:nth-child(4) > div');
                if (actionArea && !document.querySelector('.ca-import-btn')) {
                    actionArea.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const actionArea = document.querySelector('body > div > main > div > div > div > div > div > div.lg\\\\:col-span-1 > div > div:nth-child(4) > div');
                    if (actionArea) {
                        actionArea.appendChild(createButton());
                    } else {
                        const btn = createButton();
                        btn.style.position = 'fixed';
                        btn.style.top = '80px';
                        btn.style.right = '20px';
                        btn.style.zIndex = '9999';
                        document.body.appendChild(btn);
                    }
                }
            }, 3000);
        },

        character_tavern: () => {
            const observer = new MutationObserver((mutations, obs) => {
                const downloadBtn = document.querySelector('a[download], button[class*="download"]');
                if (downloadBtn && !document.querySelector('.ca-import-btn')) {
                    downloadBtn.parentElement.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.position = 'fixed';
                    btn.style.top = '80px';
                    btn.style.right = '20px';
                    btn.style.zIndex = '9999';
                    document.body.appendChild(btn);
                }
            }, 3000);
        },

        risu: () => {
            const observer = new MutationObserver((mutations, obs) => {
                const actionArea = document.querySelector('[class*="download"], [class*="action"], .flex.gap');
                if (actionArea && !document.querySelector('.ca-import-btn')) {
                    actionArea.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.position = 'fixed';
                    btn.style.top = '80px';
                    btn.style.right = '20px';
                    btn.style.zIndex = '9999';
                    document.body.appendChild(btn);
                }
            }, 3000);
        }
    };

    GM_registerMenuCommand('Configure Card Architect API URL', () => {
        const current = getApiUrl();
        const newUrl = prompt('Enter Card Architect API URL:', current);
        if (newUrl && newUrl.trim()) {
            setApiUrl(newUrl.trim());
            showToast(\`API URL updated to: \${newUrl.trim()}\`, 'success');
        }
    });

    function init() {
        const siteInfo = detectSite();
        if (!siteInfo) return;

        injectStyles();

        const injector = siteInjectors[siteInfo.site];
        if (injector) {
            injector();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
`;
}
