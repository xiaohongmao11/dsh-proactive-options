# 主动回复选项（dsh-proactive-options）

把**需要你拍板的问题**变成**可点一下的选项**。不用手打「好」「不要」「A 吧」。

适用场景就两类：

1. **执行中要确认**：我正在做某件事，需要问「继续这样做吗」「要不要给你这个权限」——是/否两个按钮。
2. **你交代新任务时**：我先把你说的解析成 2–4 个方案，你点一个，我再动手。

## 安装（DSH 独立使用）

```bash
# 直接从 GitHub 安装
dsh plugin --profile desktop add github:xiaohongmao11/dsh-proactive-options

# 本地开发
dsh plugin --profile desktop add link:D:\缓存\Dsh workspace\dsh-proactive-options
```

装完重启 DSH。之后我就能调用 `reply_options` 工具，选项会以 DSH 原生选项框弹出来。

## 装进宠物（dsh-pet）

同一个包，剪掉「宿主插件」那层壳就行：

```js
import { askOptions, normalizeAskArgs } from 'dsh-proactive-options'

// 宠物里：先把问题说出来，再把选项交给它自己的 UI
const norm = normalizeAskArgs({ question: '这个方案继续做吗' })
kit.say(norm.question)
const out = await askOptions(ctx, { agent: exec.agent, signal: exec.signal }, norm)
```

宠物可以用原生选项框，也可以把 `norm.options` 画成自己气泡里的按钮——**能力只有一份，呈现各管各的**。

## 工具签名

| 参数 | 必填 | 说明 |
|---|---|---|
| `question` | ✅ | 要问的问题，一句话 |
| `options` | — | 2–6 个 `{label, description?}`；**省略时自动给「是，继续 / 不，先停」** |
| `header` | — | 短标题，≤12 字 |
| `detail` | — | 补充说明 |
| `multiSelect` | — | 是否多选，默认否 |

返回：`{ ok, picked: string[], custom?: string, reason?: string }`，模型侧看到的是 `[用户选了：是，继续]`。

## 自动重启也在选项里

装新插件、改完配置需要重启时，不再让用户自己去点菜单——同一个插件提供 `restart_dsh` 工具：

1. 先弹「重启 / 不重启」两个选项；
2. 用户点「重启」→ 才真的派发重启（独立 PowerShell 进程，脱离宿主进程树）；
3. 点「不重启」→ 什么都不做。

派发有 60 秒防抖，连点不会重复重启。

## 设计取舍

- **为什么不做「点一下直接替用户发送」**：DSH 客户端只有 `inputActions.insertText()`（把文字插进草稿），没有代用户提交的接口。硬做只能模拟回车，草稿里已有内容会被一起发出去。所以本插件只负责「问」和「选」，发送永远由用户自己按。
- **为什么不把 `AbortSignal` 传进 `userQuestions.ask`**：那个调用要过 remote 网关做无损 JSON 序列化，`AbortSignal` 传不过去，会直接报 `api gateway: Remote event request is not lossless JSON data`。
- **为什么 `inject` 是空的**：拿不到 `tools` 服务时，最坏结果只是「工具没注册」，绝不会让插件 entry 变成 pending/failed 拖垮整栈。
- **为什么 core 单独一个文件**：DSH 独立跑和宠物里跑必须用同一套参数规范化与回执格式，否则两边行为迟早走偏。

## 状态

- v0.1.1：宿主插件 + 可复用核心 + 自动重启（走选项）+ 自检（20 项）
- 计划：输入框上方的常驻按钮条（走 `conversation.input.activity` 插槽 + `insertText`）

## 许可

MIT
