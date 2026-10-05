import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../card2brain-to-quizlet.user.js', import.meta.url), 'utf8');
const metadata = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/)?.[1] || '';

assert.match(metadata, /@match\s+https:\/\/card2brain\.ch\/\*/);
assert.match(metadata, /@grant\s+GM_setClipboard/);
assert.doesNotMatch(metadata, /@connect\b/);
assert.doesNotMatch(source, /google-analytics|googletagmanager|segment\.com|mixpanel/i);
assert.match(source, /const MAX_ATTEMPTS = 3/);
assert.match(source, /actualIndex - 1 !== expectedIndex/);
assert.match(source, /return `\$\{term\}\\t\$\{definition\}`/);
assert.match(source, /Export wurde aus Sicherheitsgründen nicht erstellt/);

console.log('Userscript metadata and fail-closed export checks: PASS');
