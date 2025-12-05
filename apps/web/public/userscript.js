// ==UserScript==
// @name         Card Architect - Web Import (Static)
// @namespace    https://ca.axailotl.ai
// @version      2.0.0
// @description  Send character cards from supported sites to Card Architect (client-side version)
// @author       Card Architect
// @match        https://chub.ai/characters/*
// @match        https://www.chub.ai/characters/*
// @match        https://venus.chub.ai/characters/*
// @match        https://app.wyvern.chat/characters/*
// @match        https://character-tavern.com/character/*
// @match        https://realm.risuai.net/character/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const DEFAULT_WEB_URL = 'https://ca.axailotl.ai';
    const PENDING_IMPORT_KEY = 'ca-pending-import';

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
        .ca-toast.success { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .ca-toast.error { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .ca-toast.info { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); }
        .ca-toast a { color: white; text-decoration: underline; }
        @keyframes ca-slide-in {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;

    const IMPORT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

    function getWebUrl() {
        return GM_getValue('cardArchitectWebUrl', DEFAULT_WEB_URL);
    }

    function setWebUrl(url) {
        GM_setValue('cardArchitectWebUrl', url);
    }

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

    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = BUTTON_STYLES;
        document.head.appendChild(style);
    }

    function createButton() {
        const btn = document.createElement('button');
        btn.className = 'ca-import-btn';
        btn.innerHTML = `${IMPORT_ICON} Send to Card Architect`;
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
            const parts = path.split('/character/')[1];
            return { site: 'character_tavern', id: parts?.replace(/\/$/, '') };
        }
        if (host === 'realm.risuai.net' && path.startsWith('/character/')) {
            return { site: 'risu', id: path.split('/character/')[1]?.split('/')[0] };
        }
        return null;
    }

    function extractChubId(path) {
        const match = path.match(/\/characters\/([^/]+\/[^/]+)/);
        return match ? match[1] : null;
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Fetch Chub card data client-side
    async function fetchChubData(fullPath) {
        const [creator, slug] = fullPath.split('/');
        console.log('[CA] Fetching Chub data for', creator, slug);

        const metaUrl = `https://gateway.chub.ai/api/characters/${creator}/${slug}?full=true`;
        const metaResponse = await fetch(metaUrl);
        if (!metaResponse.ok) throw new Error(`Chub API returned ${metaResponse.status}`);
        const metaData = await metaResponse.json();
        const projectId = metaData.node?.id || metaData.node?.definition?.id;

        const cardUrl = `https://gateway.chub.ai/api/v4/projects/${projectId}/repository/files/card.json/raw?ref=main&response_type=blob`;
        const cardResponse = await fetch(cardUrl);
        if (!cardResponse.ok) throw new Error(`Chub card API returned ${cardResponse.status}`);
        const cardData = await cardResponse.json();

        let avatarBase64 = null;
        const avatarUrl = metaData.node?.max_res_url || metaData.node?.avatar_url;
        if (avatarUrl) {
            try {
                const avatarResponse = await fetch(avatarUrl);
                if (avatarResponse.ok) {
                    const blob = await avatarResponse.blob();
                    avatarBase64 = await blobToBase64(blob);
                }
            } catch (err) {
                console.warn('[CA] Failed to fetch avatar:', err);
            }
        }

        return { cardData, avatarBase64 };
    }

    // Fetch Risu character PNG client-side
    async function fetchRisuData(uuid) {
        console.log('[CA] Fetching Risu data for', uuid);

        const pngUrl = `https://realm.risuai.net/api/v1/download/png-v3/${uuid}`;
        const pngResponse = await fetch(pngUrl);
        if (!pngResponse.ok) throw new Error(`Risu returned ${pngResponse.status}`);
        const blob = await pngResponse.blob();
        const base64 = await blobToBase64(blob);
        return { pngBase64: base64 };
    }

    // Fetch Character Tavern PNG client-side
    async function fetchCharacterTavernData(pathParts) {
        const [creator, slug] = pathParts.split('/');
        console.log('[CA] Fetching Character Tavern data for', creator, slug);

        const pngUrl = `https://cards.character-tavern.com/${creator}/${slug}.png?action=download`;
        const pngResponse = await fetch(pngUrl);
        if (!pngResponse.ok) throw new Error(`Character Tavern returned ${pngResponse.status}`);
        const blob = await pngResponse.blob();
        const base64 = await blobToBase64(blob);
        return { pngBase64: base64 };
    }

    // Intercept Wyvern download
    function fetchWyvernPng() {
        return new Promise((resolve, reject) => {
            const originalCreateObjectURL = URL.createObjectURL.bind(URL);
            let captured = false;

            URL.createObjectURL = function(blob) {
                const url = originalCreateObjectURL(blob);
                if (!captured && blob instanceof Blob && blob.type === 'image/png') {
                    captured = true;
                    URL.createObjectURL = originalCreateObjectURL;
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Failed to read blob'));
                    reader.readAsDataURL(blob);
                }
                return url;
            };

            const findAndClickDownload = () => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('download') || text.includes('export') || text.includes('png')) {
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
                            reject(new Error('Timeout waiting for PNG'));
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

    async function handleImport(e) {
        const btn = e.target.closest('.ca-import-btn');
        if (!btn || btn.disabled) return;

        const siteInfo = detectSite();
        if (!siteInfo || !siteInfo.id) {
            showToast('Could not detect character ID from URL', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = `${IMPORT_ICON} Fetching data...`;

        try {
            const webUrl = getWebUrl();
            let importData = {
                site: siteInfo.site,
                url: window.location.href,
                timestamp: Date.now()
            };

            // Fetch data based on site
            if (siteInfo.site === 'chub') {
                const data = await fetchChubData(siteInfo.id);
                importData.cardData = data.cardData;
                importData.avatarBase64 = data.avatarBase64;
            }
            else if (siteInfo.site === 'risu') {
                const data = await fetchRisuData(siteInfo.id);
                importData.pngBase64 = data.pngBase64;
            }
            else if (siteInfo.site === 'character_tavern') {
                const data = await fetchCharacterTavernData(siteInfo.id);
                importData.pngBase64 = data.pngBase64;
            }
            else if (siteInfo.site === 'wyvern') {
                btn.innerHTML = `${IMPORT_ICON} Capturing PNG...`;
                importData.pngBase64 = await fetchWyvernPng();
            }

            btn.innerHTML = `${IMPORT_ICON} Opening Card Architect...`;

            // Store in localStorage for Card Architect to pick up
            localStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(importData));

            // Open Card Architect import page - it will process the pending import
            const importUrl = `${webUrl}/#/import-pending`;
            window.open(importUrl, '_blank');

            showToast('Card Architect opened! Check the new tab.', 'success');
        } catch (err) {
            console.error('Card Architect import error:', err);
            showToast(`Import failed: ${err.message}`, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `${IMPORT_ICON} Send to Card Architect`;
        }
    }

    const siteInjectors = {
        chub: () => {
            const observer = new MutationObserver((mutations, obs) => {
                const actionArea = document.querySelector('.flex.gap-2, [class*="actions"]');
                if (actionArea && !document.querySelector('.ca-import-btn')) {
                    actionArea.appendChild(createButton());
                    obs.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999';
                    document.body.appendChild(btn);
                }
            }, 3000);
        },

        wyvern: () => {
            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999';
                    document.body.appendChild(btn);
                }
            }, 2000);
        },

        character_tavern: () => {
            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999';
                    document.body.appendChild(btn);
                }
            }, 2000);
        },

        risu: () => {
            setTimeout(() => {
                if (!document.querySelector('.ca-import-btn')) {
                    const btn = createButton();
                    btn.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999';
                    document.body.appendChild(btn);
                }
            }, 2000);
        }
    };

    GM_registerMenuCommand('Configure Card Architect URL', () => {
        const current = getWebUrl();
        const newUrl = prompt('Enter Card Architect URL:', current);
        if (newUrl && newUrl.trim()) {
            setWebUrl(newUrl.trim());
            showToast(`URL updated to: ${newUrl.trim()}`, 'success');
        }
    });

    function init() {
        const siteInfo = detectSite();
        if (!siteInfo) return;
        injectStyles();
        const injector = siteInjectors[siteInfo.site];
        if (injector) injector();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
