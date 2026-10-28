# Proactive Reply Options (dsh-proactive-options)

Turn **decisions you need to make** into **one-click options** — no more typing "ok", "no", or "A".

Two use cases, nothing else:

1. **Mid-task confirmation** — "Keep going like this?" / "Give me that permission?" → yes/no buttons.
2. **New task handed over** — the assistant first parses what you said into 2–4 options; you pick one and it starts.

## Install (standalone in DSH)

```bash
dsh plugin --profile desktop add dsh-proactive-options

# local development
dsh plugin --profile desktop add link:<absolute-path-to-this-dir>
```

Restart DSH afterwards. The assistant then gets a `reply_options` tool that renders DSH's native option UI.

## Use inside a pet plugin (e.g. dsh-pet)

Same package, skip the host shell:

```js
import { askOptions, normalizeAskArgs } from 'dsh-proactive-options'

const norm = normalizeAskArgs({ question: 'Keep going with this plan?' })
kit.say(norm.question)
const out = await askOptions(ctx, { agent: exec.agent, signal: exec.signal }, norm)
```

One capability, different presentation.

## Tool contract

| arg | required | meaning |
|---|---|---|
| `question` | ✅ | one-line question |
| `options` | — | 2–6 × `{label, description?}`; **omitted → automatic "Yes, continue / No, stop"** |
| `header` | — | short title, ≤12 chars |
| `detail` | — | extra context |
| `multiSelect` | — | default false |

Returns `{ ok, picked, custom?, reason? }`; the model sees `[用户选了：是，继续]`.

## Design notes

- **No auto-send on click.** The DSH client exposes only `inputActions.insertText()` — there is no API to submit on the user's behalf. Faking an Enter keypress would also submit any text already in the draft, so this plugin only asks and records; sending stays in the user's hands.
- **`inject` is empty on purpose.** Without the `tools` service the worst case is "tool not registered" — never a pending/failed entry that breaks the stack.
- **`core.js` is host-free.** Standalone and in-pet runs must share the same argument normalization and receipt format.

## Status

- v0.1.0 — host plugin + reusable core + 18 self-checks
- Planned — a persistent option bar above the composer (`conversation.input.activity` + `insertText`)

## License

MIT
