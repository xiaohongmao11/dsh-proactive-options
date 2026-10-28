# Proactive Reply Options (dsh-proactive-options)

Turn **decisions you need to make** into **one-click options** 鈥?no more typing "ok", "no", or "A".

Two use cases, nothing else:

1. **Mid-task confirmation** 鈥?"Keep going like this?" / "Give me that permission?" 鈫?yes/no buttons.
2. **New task handed over** 鈥?the assistant first parses what you said into 2鈥? options; you pick one and it starts.

## Install (standalone in DSH)

```bash
dsh plugin --profile desktop add github:xiaohongmao11/dsh-proactive-options

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
| `question` | 鉁?| one-line question |
| `options` | 鈥?| 2鈥? 脳 `{label, description?}`; **omitted 鈫?automatic "Yes, continue / No, stop"** |
| `header` | 鈥?| short title, 鈮?2 chars |
| `detail` | 鈥?| extra context |
| `multiSelect` | 鈥?| default false |

Returns `{ ok, picked, custom?, reason? }`; the model sees `[鐢ㄦ埛閫変簡锛氭槸锛岀户缁璢`.

## Auto-restart is an option too

When new plugins or profile changes need a restart, the same plugin ships a `restart_dsh` tool:

1. It first shows two options: **Restart / Don't restart**.
2. Only a click on "Restart" dispatches the reboot (a detached PowerShell process, outside the host process tree).
3. A 60-second debounce prevents double restarts.

## Design notes

- **No auto-send on click.** The DSH client exposes only `inputActions.insertText()` 鈥?there is no API to submit on the user's behalf. Faking an Enter keypress would also submit any text already in the draft, so this plugin only asks and records; sending stays in the user's hands.
- **`inject` is empty on purpose.** Without the `tools` service the worst case is "tool not registered" 鈥?never a pending/failed entry that breaks the stack.
- **`core.js` is host-free.** Standalone and in-pet runs must share the same argument normalization and receipt format.

## Status

- v0.1.0 鈥?host plugin + reusable core + 18 self-checks
- Planned 鈥?a persistent option bar above the composer (`conversation.input.activity` + `insertText`)

## License

MIT
