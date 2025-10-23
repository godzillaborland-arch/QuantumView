
# The Sanctuary — QuantumView

Live: `https://godzillaborland-arch.github.io/QuantumView/`

This repo serves the Sanctuary website (QuantumView layout): Featured Video, Meditation Monitor App, Latest Content, Contribute Wisdom, Wisdom Wall, and Ask the Sanctuary (Gemini).

## Files
- `index.html` — main site (YouTube hero, Meditation App embed, links, playlists, Ask the Sanctuary)
- `submit.html` — users submit wisdom (kept from your previous site; includes short thank-you, then redirects to `wisdom.html`)
- `wisdom.html` — public Wisdom Wall (word-cloud style)

> You said you’ll **reuse** `submit.html` and `wisdom.html`. Place them in the repo root.

## Deploy (GitHub Pages)
1. Put all files in repo root (no subfolder).
2. In GitHub: **Settings → Pages → Source = `main` (root)**.
3. Wait ~1–2 minutes, then open the live URL.

## Plausible Analytics
Already embedded with your project script:
```html
<script async src="https://plausible.io/js/pa-Nj2nSV8L4u6iRao34TF3q.js"></script>
<script>
  window.plausible = window.plausible || function(){(plausible.q = plausible.q || []).push(arguments)};
  plausible.init = plausible.init || function(i){plausible.o = i || {}};
  plausible.init();
</script>
