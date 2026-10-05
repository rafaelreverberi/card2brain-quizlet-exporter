import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { DOMParser } from 'linkedom';

const source = fs.readFileSync(new URL('../card2brain-to-quizlet.user.js', import.meta.url), 'utf8');
const context = vm.createContext({ DOMParser });
vm.runInContext(source.replace('    watchDynamicNavigation();',
    '    globalThis.exportFunctions = { parseCard, createQuizletExport };'), context);
const { parseCard, createQuizletExport } = context.exportFunctions;

const example = text => `<div class="d-flex align-items-center mb-2" style="font-style: italic">${text}<img alt="AI Logo" title="Erstellt von card2brain"></div>`;
const html = (front, back, offset = 0) => `<div class="flip-card-index" data-offset="${offset}">
    <div class="flip-card-front"><section>${front}</section><div>Keyboard commands</div></div>
    <div class="flip-card-back"><section>${back}</section></div>
</div>`;
const card = parseCard(html(`être${example('Je suis très heureux aujourd’hui.')}`,
    `<p>sein</p>${example('Ich bin heute sehr glücklich.')}`), 0);
assert.equal(createQuizletExport([card]), 'être\tsein');
assert.equal(createQuizletExport([card], true),
    'être · Je suis très heureux aujourd’hui.\tsein · Ich bin heute sehr glücklich.');
assert.doesNotMatch(createQuizletExport([card], true), /AI Logo|Keyboard commands/);

// Normal formatting, images with meaningful alt text, and cards without examples survive.
const plain = parseCard(html('<div><em>aller</em></div><br>à pied', '<p>gehen</p><img alt="zu Fuss">'), 0);
assert.equal(createQuizletExport([plain]), 'aller · à pied\tgehenzu Fuss');
assert.equal(createQuizletExport([plain], true), createQuizletExport([plain]));
assert.equal(createQuizletExport([card, card]).split('\n').length, 2);
assert.equal(createQuizletExport([card], true).split('\t').length, 2);
assert.equal(createQuizletExport([card], false), 'être\tsein');
assert.throws(() => parseCard(html('être', 'sein', 1), 0), /erwartete Karte/);
assert.throws(() => parseCard(html(example('Example only'), 'sein'), 0), /exportierbaren Text/);
console.log('Optional example sentences, ordinary card content, TSV and index checks: PASS');
