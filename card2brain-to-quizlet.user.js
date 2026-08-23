// ==UserScript==
// @name         Card2Brain → Quizlet Export
// @namespace    https://github.com/rafaelreverberi/card2brain-quizlet-exporter
// @version      1.1.0
// @description  Exportiert alle Lernkarten einer Card2Brain-Kartei vollständig für Quizlet.
// @match        https://card2brain.ch/*
// @homepageURL  https://github.com/rafaelreverberi/card2brain-quizlet-exporter
// @supportURL   https://github.com/rafaelreverberi/card2brain-quizlet-exporter/issues
// @updateURL    https://raw.githubusercontent.com/rafaelreverberi/card2brain-quizlet-exporter/main/card2brain-to-quizlet.user.js
// @downloadURL  https://raw.githubusercontent.com/rafaelreverberi/card2brain-quizlet-exporter/main/card2brain-to-quizlet.user.js
// @license      MIT
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const SCRIPT_ID = 'c2b-quizlet-export';
    const MAX_ATTEMPTS = 3;
    const CONCURRENCY = 6;
    let activeBoxAlias = null;
    let activeExport = null;
    let modalInstance = null;

    function detectCurrentBox() {
        const match = location.pathname.match(/^\/box\/([^/]+)\/?$/);
        return match ? decodeURIComponent(match[1]) : null;
    }

    function canonicalBoxUrl(alias) {
        return `${location.origin}/box/${encodeURIComponent(alias)}`;
    }

    function parseHtml(html) {
        return new DOMParser().parseFromString(html, 'text/html');
    }

    function positiveInteger(value) {
        const number = Number.parseInt(String(value ?? ''), 10);
        return Number.isSafeInteger(number) && number > 0 ? number : null;
    }

    function readMetadataFromDocument(doc, alias) {
        const carousel = doc.querySelector('#flip-mode-carousel[data-max]');
        const total = positiveInteger(carousel?.getAttribute('data-max'));
        const title = doc.querySelector('#box[itemprop="name"]')?.textContent?.trim()
            || doc.querySelector('h1')?.textContent?.trim()
            || alias;
        const endpoint = carousel?.getAttribute('data-url');
        if (!total || !endpoint) {
            throw new Error('Die Gesamtzahl oder der Karten-Endpunkt konnte nicht ermittelt werden.');
        }
        return {
            alias,
            title,
            total,
            endpoint: new URL(endpoint, canonicalBoxUrl(alias)).href,
        };
    }

    async function fetchWithRetry(url, attempts = MAX_ATTEMPTS) {
        let lastError;
        for (let attempt = 1; attempt <= attempts; attempt += 1) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: { Accept: 'text/html' },
                    cache: 'no-store',
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.text();
            } catch (error) {
                lastError = error;
                if (attempt < attempts) {
                    await new Promise(resolve => setTimeout(resolve, 350 * attempt));
                }
            }
        }
        throw lastError;
    }

    async function getBoxMetadata(alias) {
        try {
            if (detectCurrentBox() === alias) return readMetadataFromDocument(document, alias);
        } catch (_) {
            // A dynamically navigated page may not be rendered yet; fetch the canonical page below.
        }
        const html = await fetchWithRetry(canonicalBoxUrl(alias));
        return readMetadataFromDocument(parseHtml(html), alias);
    }

    function readableText(element) {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style, button, audio, video').forEach(node => node.remove());
        clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        clone.querySelectorAll('img[alt]').forEach(img => img.replaceWith(img.getAttribute('alt') || ''));
        return (clone.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\r/g, '')
            .replace(/[\t\f\v ]+/g, ' ')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join(' · ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function parseCard(html, expectedIndex) {
        const doc = parseHtml(html);
        const card = doc.querySelector('.flip-card-index[data-offset]');
        const actualIndex = positiveInteger(Number(card?.getAttribute('data-offset')) + 1);
        if (!card || actualIndex === null || actualIndex - 1 !== expectedIndex) {
            throw new Error(`Card2Brain lieferte nicht die erwartete Karte ${expectedIndex + 1}.`);
        }
        // The front also contains viewer controls and keyboard hints. The semantic
        // section inside each side is the actual learning-card content.
        const term = readableText(card.querySelector('.flip-card-front section'));
        const definition = readableText(card.querySelector('.flip-card-back section'));
        if (!term || !definition) {
            throw new Error(`Karte ${expectedIndex + 1} enthält keinen vollständig exportierbaren Text.`);
        }
        return { index: expectedIndex, term, definition };
    }

    function cardUrl(metadata, index) {
        const url = new URL(metadata.endpoint);
        url.searchParams.set('offset', String(index));
        return url.href;
    }

    async function fetchAllCards(metadata, onProgress) {
        const cards = new Array(metadata.total);
        const failed = [];
        let nextIndex = 0;
        let completed = 0;

        async function worker() {
            while (true) {
                const index = nextIndex;
                nextIndex += 1;
                if (index >= metadata.total) return;
                try {
                    const html = await fetchWithRetry(cardUrl(metadata, index));
                    cards[index] = parseCard(html, index);
                } catch (error) {
                    failed.push({ index, error });
                } finally {
                    completed += 1;
                    onProgress(completed, metadata.total);
                }
            }
        }

        await Promise.all(Array.from(
            { length: Math.min(CONCURRENCY, metadata.total) },
            () => worker(),
        ));

        if (failed.length || cards.some(card => !card)) {
            const loaded = cards.filter(Boolean).length;
            throw new Error(
                `Card2Brain meldet ${metadata.total} Karten, aber nur ${loaded} konnten geladen werden.\n\n`
                + 'Export wurde aus Sicherheitsgründen nicht erstellt.',
            );
        }
        return cards;
    }

    function createQuizletExport(cards) {
        return cards.map(card => `${card.term}\t${card.definition}`).join('\n');
    }

    function slugify(value) {
        return value
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'card2brain-lernkarten';
    }

    function ensureDialog() {
        let dialog = document.getElementById(`${SCRIPT_ID}-modal`);
        if (dialog) return dialog;
        dialog = document.createElement('div');
        dialog.id = `${SCRIPT_ID}-modal`;
        dialog.className = 'modal fade';
        dialog.tabIndex = -1;
        dialog.setAttribute('aria-labelledby', `${SCRIPT_ID}-title`);
        dialog.setAttribute('aria-hidden', 'true');
        dialog.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${SCRIPT_ID}-title">Quizlet Export</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Schliessen"></button>
                    </div>
                    <div class="modal-body">
                        <p id="${SCRIPT_ID}-status" class="mb-2">Bereit.</p>
                        <div id="${SCRIPT_ID}-progress-wrap" class="progress mb-3" role="progressbar" aria-valuemin="0" aria-valuemax="100">
                            <div id="${SCRIPT_ID}-progress" class="progress-bar" style="width: 0%"></div>
                        </div>
                        <div id="${SCRIPT_ID}-feedback" class="alert d-none mb-0" role="alert"></div>
                    </div>
                    <div class="modal-footer">
                        <button id="${SCRIPT_ID}-copy" type="button" class="btn btn-info" disabled>
                            <i class="fal fa-copy"></i><span class="ms-2">In Zwischenablage kopieren</span>
                        </button>
                        <button id="${SCRIPT_ID}-download" type="button" class="btn btn-outline-info" disabled>
                            <i class="fal fa-download"></i><span class="ms-2">TXT herunterladen</span>
                        </button>
                        <a href="https://quizlet.com/create-set" target="_blank" rel="noopener noreferrer" class="btn btn-link">Quizlet öffnen</a>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(dialog);
        dialog.querySelector(`#${SCRIPT_ID}-copy`).addEventListener('click', copyExport);
        dialog.querySelector(`#${SCRIPT_ID}-download`).addEventListener('click', downloadExport);
        return dialog;
    }

    function showDialog() {
        const dialog = ensureDialog();
        if (window.bootstrap?.Modal) {
            modalInstance = window.bootstrap.Modal.getOrCreateInstance(dialog);
            modalInstance.show();
        } else {
            dialog.classList.add('show');
            dialog.style.display = 'block';
            dialog.removeAttribute('aria-hidden');
        }
        return dialog;
    }

    function setFeedback(kind, message) {
        const feedback = document.getElementById(`${SCRIPT_ID}-feedback`);
        feedback.className = `alert alert-${kind} mb-0`;
        feedback.textContent = message;
    }

    function setProgress(done, total) {
        const percent = total ? Math.round((done / total) * 100) : 0;
        const bar = document.getElementById(`${SCRIPT_ID}-progress`);
        bar.style.width = `${percent}%`;
        bar.parentElement.setAttribute('aria-valuenow', String(percent));
        document.getElementById(`${SCRIPT_ID}-status`).textContent = `Lade Lernkarten… ${done} / ${total}`;
    }

    async function runExport() {
        const alias = detectCurrentBox();
        if (!alias) return;
        showDialog();
        activeExport = null;
        document.getElementById(`${SCRIPT_ID}-copy`).disabled = true;
        document.getElementById(`${SCRIPT_ID}-download`).disabled = true;
        document.getElementById(`${SCRIPT_ID}-feedback`).className = 'alert d-none mb-0';
        document.getElementById(`${SCRIPT_ID}-status`).textContent = 'Lade Metadaten…';
        try {
            const metadata = await getBoxMetadata(alias);
            setProgress(0, metadata.total);
            const cards = await fetchAllCards(metadata, setProgress);
            activeExport = {
                text: createQuizletExport(cards),
                cards,
                metadata,
                filename: `${slugify(metadata.title)}-quizlet.txt`,
            };
            document.getElementById(`${SCRIPT_ID}-status`).textContent = `${cards.length} Karten gefunden`;
            setFeedback('success', `Gefunden: ${cards.length} / ${metadata.total} Karten`);
            document.getElementById(`${SCRIPT_ID}-copy`).disabled = false;
            document.getElementById(`${SCRIPT_ID}-download`).disabled = false;
        } catch (error) {
            document.getElementById(`${SCRIPT_ID}-status`).textContent = 'Export fehlgeschlagen';
            setFeedback('danger', error?.message || String(error));
        }
    }

    async function copyExport() {
        if (!activeExport) return;
        try {
            if (typeof GM_setClipboard === 'function') {
                GM_setClipboard(activeExport.text, 'text');
            } else {
                await navigator.clipboard.writeText(activeExport.text);
            }
            setFeedback('success', `${activeExport.cards.length} Karten wurden für Quizlet kopiert.`);
        } catch (error) {
            setFeedback('danger', `Kopieren fehlgeschlagen: ${error?.message || error}`);
        }
    }

    function downloadExport() {
        if (!activeExport) return;
        const blob = new Blob([`\uFEFF${activeExport.text}`], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = activeExport.filename;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        setFeedback('success', `${activeExport.cards.length} Karten wurden als UTF-8-TXT gespeichert.`);
    }

    function makeButton(classes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = classes;
        button.dataset.c2bQuizletExport = 'true';
        button.innerHTML = '<i class="fal fa-file-export"></i><span class="ms-2">Quizlet exportieren</span>';
        button.addEventListener('click', runExport);
        return button;
    }

    function injectExportButton() {
        const alias = detectCurrentBox();
        if (!alias) {
            document.querySelectorAll('[data-c2b-quizlet-export]').forEach(node => node.remove());
            activeBoxAlias = null;
            return;
        }
        if (activeBoxAlias !== alias) {
            document.querySelectorAll('[data-c2b-quizlet-export]').forEach(node => node.remove());
            activeBoxAlias = alias;
        }
        if (document.querySelector('[data-c2b-quizlet-export]')) return;

        const heading = document.querySelector('#box[itemprop="name"]');
        const profileHeader = heading?.closest('.c2b-profile-header');
        const learnGroup = profileHeader?.querySelector('.btn-group[role="group"]');
        if (learnGroup) {
            learnGroup.insertAdjacentElement(
                'afterend',
                makeButton('btn btn-info btn-sm d-none d-lg-inline-flex align-items-center me-4'),
            );
        }

        const mobileLearn = profileHeader?.querySelector('a.d-lg-none.btn.btn-info');
        if (mobileLearn) {
            mobileLearn.insertAdjacentElement(
                'afterend',
                makeButton('btn btn-info btn-sm d-lg-none d-inline-flex align-items-center ms-2'),
            );
        }
    }

    function watchDynamicNavigation() {
        const schedule = (() => {
            let timer;
            return () => {
                clearTimeout(timer);
                timer = setTimeout(injectExportButton, 100);
            };
        })();
        new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
        window.addEventListener('popstate', schedule);
        for (const method of ['pushState', 'replaceState']) {
            const original = history[method];
            history[method] = function (...args) {
                const result = original.apply(this, args);
                schedule();
                return result;
            };
        }
        injectExportButton();
    }

    watchDynamicNavigation();
})();
