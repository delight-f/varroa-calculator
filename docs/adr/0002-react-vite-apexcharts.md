The web front end is a single-page interactive tool built with **React + Vite
+ ApexCharts**, deployed as a static site on GitHub Pages.

We chose React + Vite (over Svelte/vanilla TS) for the density of AI-tooling
training data and the size of the ecosystem — the project is maintained by a
vibe coder who leans on AI assistants, so the path assistants know best is the
decisive factor.

We chose ApexCharts (over Chart.js/Recharts/Plotly) for polished, professional
chart defaults with the least configuration effort: smooth animated transitions
when treatments are applied (the trajectory visibly bends — immediate
feedback), built-in annotations for the crash zone, "now" marker, and threshold
lines. The ~450KB bundle size is irrelevant for a desk planning tool on wifi.

Output is a static `dist/` folder deployed to GitHub Pages on the default
`*.github.io` URL for v1; a custom domain can come later.
