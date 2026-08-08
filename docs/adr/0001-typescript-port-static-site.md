# TypeScript port running client-side as a static site

The Varroa model is small (~520 lines), pure-stdlib Python (`math`, `json`,
`os`, `dataclasses`), deterministic, and trivially fast (24 periods of
arithmetic). We will port it to TypeScript and ship a static site (e.g. GitHub
Pages) that runs the model entirely in the browser.

We rejected keeping Python server-side (FastAPI/Flask): it adds hosting cost,
idle uptime, cold starts, and a network round-trip on every slider drag — wrong
tradeoff for a tool beekeepers use a few times a year. We also rejected Pyodide
(running the real Python via WASM): the ~6–10 MB runtime download and startup
delay is a real UX cost for a casual-use tool.

The risk is a duplicated arithmetic implementation drifting from the validated
Python reference. We de-risk it with a **golden-output parity test**: fixed
inputs → same 24-row trajectory as the Python model. The Python reference stays
frozen and authoritative; the TS port proves equivalence against it.
