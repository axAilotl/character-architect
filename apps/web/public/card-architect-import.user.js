// ==UserScript==
// @name         Card Architect - Web Import
// @namespace    https://card-architect.local
// @version      1.0.2
// @description  Send character cards from supported sites to Card Architect
// @author       Card Architect
// @match        https://chub.ai/characters/*
// @match        https://www.chub.ai/characters/*
// @match        https://venus.chub.ai/characters/*
// @match        https://app.wyvern.chat/characters/*
// @match        https://charactertavern.com/character/*
// @match        https://realm.risuai.net/character/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      localhost
// @connect      127.0.0.1
// @connect      192.168.1.220
// @connect      192.168.0.1
// @connect      192.168.1.1
// @connect      10.0.0.1
// ==/UserScript==
// NOTE: If your Card Architect server is on a different IP, edit this script
// and add your IP to the @connect list above, then save.

(function() {
    'use strict';

    // Configuration
    const DEFAULT_API_URL = 'http://localhost:3001/api';
    const BUTTON_STYLES = `
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
    `;

    // Icon SVG
    const IMPORT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

    // Get API URL from storage
    function getApiUrl() {
        return GM_getValue('cardArchitectApiUrl', DEFAULT_API_URL);
    }

    // Set API URL
    function setApiUrl(url) {
        GM_setValue('cardArchitectApiUrl', url);
    }

    // Show toast notification
    function showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `ca-toast ${type}`;
        toast.innerHTML = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'ca-slide-in 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Inject styles
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = BUTTON_STYLES;
        document.head.appendChild(style);
    }

    // Create import button
    function createButton() {
        const btn = document.createElement('button');
        btn.className = 'ca-import-btn';
        btn.innerHTML = `${IMPORT_ICON} Send to Card Architect`;
        btn.addEventListener('click', handleImport);
        return btn;
    }

    // Detect current site
    function detectSite() {
        const host = window.location.hostname;
        const path = window.location.pathname;

        if (host.includes('chub.ai')) {
            return { site: 'chub', id: extractChubId(path) };
        }
        if (host === 'app.wyvern.chat' && path.startsWith('/characters/')) {
            return { site: 'wyvern', id: path.split('/characters/')[1]?.split('/')[0] };
        }
        if (host === 'charactertavern.com' && path.startsWith('/character/')) {
            return { site: 'character_tavern', id: path.split('/character/')[1]?.split('/')[0] };
        }
        if (host === 'realm.risuai.net' && path.startsWith('/character/')) {
            return { site: 'risu', id: path.split('/character/')[1]?.split('/')[0] };
        }
        return null;
    }

    // Extract Chub ID from path
    function extractChubId(path) {
        // Format: /characters/username/character-name
        const match = path.match(/\/characters\/([^/]+\/[^/]+)/);
        return match ? match[1] : null;
    }

    // Get Risu download info from page
    function getRisuDownloadInfo() {
        // Look for download button/link that indicates format
        const downloadBtn = document.querySelector('a[href*="download"], button[data-format]');
        if (downloadBtn) {
            const href = downloadBtn.getAttribute('href') || '';
            if (href.includes('.charx') || href.includes('format=charx')) {
                return { format: 'charx' };
            }
        }
        // Default to PNG (will be determined server-side)
        return { format: 'auto' };
    }

    // Handle import click
    async function handleImport(e) {
        const btn = e.target.closest('.ca-import-btn');
        if (!btn || btn.disabled) return;

        const siteInfo = detectSite();
        if (!siteInfo || !siteInfo.id) {
            showToast('Could not detect character ID from URL', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = `${IMPORT_ICON} Importing...`;

        try {
            const apiUrl = getApiUrl();
            const payload = {
                url: window.location.href,
                site: siteInfo.site,
                characterId: siteInfo.id
            };

            // Add Risu format info if applicable
            if (siteInfo.site === 'risu') {
                const downloadInfo = getRisuDownloadInfo();
                payload.format = downloadInfo.format;
            }

            const response = await gmFetch(`${apiUrl}/web-import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = JSON.parse(response);

            if (result.success) {
                const cardUrl = `${apiUrl.replace('/api', '')}/#/cards/${result.cardId}`;
                showToast(
                    `Successfully imported "${result.name}"!<br><a href="${cardUrl}" target="_blank">Open in Card Architect</a>`,
                    'success',
                    8000
                );
            } else {
                throw new Error(result.error || 'Import failed');
            }
        } catch (err) {
            console.error('Card Architect import error:', err);
            showToast(`Import failed: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `${IMPORT_ICON} Send to Card Architect`;
        }
    }

    // GM_xmlhttpRequest wrapper that returns a promise
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
                        reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
                    }
                },
                onerror: (error) => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Request timeout'))
            });
        });
    }

    // Site-specific button injection
    const siteInjectors = {
        chub: () => {
            // Wait for the page to load and find a good insertion point
            const observer = new MutationObserver((mutations, obs) => {
                // Look for the action buttons area (download, etc.)
                const actionArea = document.querySelector('.flex.gap-2, [class*="actions"], [class*="buttons"]');
                if (actionArea && !document.querySelector('.ca-import-btn')) {
                    actionArea.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Fallback: inject after 3 seconds if not found
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
                const actionArea = document.querySelector('[class*="action"], [class*="button-group"], .flex.gap');
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

    // Register menu command for settings
    GM_registerMenuCommand('Configure Card Architect API URL', () => {
        const current = getApiUrl();
        const newUrl = prompt('Enter Card Architect API URL:', current);
        if (newUrl && newUrl.trim()) {
            setApiUrl(newUrl.trim());
            showToast(`API URL updated to: ${newUrl.trim()}`, 'success');
        }
    });

    // Initialize
    function init() {
        const siteInfo = detectSite();
        if (!siteInfo) return;

        injectStyles();

        const injector = siteInjectors[siteInfo.site];
        if (injector) {
            injector();
        }
    }

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
