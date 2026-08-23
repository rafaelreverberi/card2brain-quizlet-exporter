# Security Policy

## Reporting a vulnerability

Please do not include private Card2Brain content, session cookies, access tokens, passwords, or other credentials in a public issue.

For ordinary bugs, open a GitHub issue containing only the public box URL, browser version, Tampermonkey version, and the displayed error. For a vulnerability that should not be public, use GitHub's private vulnerability reporting feature for this repository.

## Data handling

The userscript sends requests only to `https://card2brain.ch` and does not upload flashcards or account data to any third party. It requests only the `GM_setClipboard` userscript permission.
