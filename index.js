/**
 * dsh-proactive-options/index.js —— 宿主侧插件入口
 *
 * 「主动回复选项」：在我需要用户拍板的时候，把问题变成可点的选项。
 *
 * 两种跑法（同一份能力）：
 *   1. 独立装进 DSH：本文件注册工具 reply_options，走 DSH 原生选项框。
 *   2. 装进宠物（dsh-pet）：宠物 import 本文件导出的 askOptions / normalizeAskArgs，
 *      自己决定怎么展示（气泡 + 原生框 / 气泡里的按钮）。
 *
 * 硬约束：inject 必须为空。拿不到 tools 服务时只是「工具没注册」，绝不拖垮 entry。
 */

import { formatAnswer, normalizeAskArgs, validateAsk } from './core.js'

export const name = 'dsh-proactive-options'
export const VERSION = '0.1.0'
export const inject = []

const TAG = '[reply-options]'
function log(...args) {
  try {
    console.log(TAG, ...args)
  } catch {
    /* ignore */
  }
}

/**
 * 核心能力：把一个问题变成选项，等用户选。
 * 不依赖本插件是否被 apply —— 宠物等外部调用方可以直接用它。
 *
 * @param {object} ctx    宿主 ctx（用来取 userQuestions 服务）
 * @param {object} world  { agent, signal }，agent 必须来自当前会话
 * @param {object} args   见 core.normalizeAskArgs
 */
export async function askOptions(ctx, world, args) {
  const check = validateAsk(args)
  if (!check.ok) return { ok: false, reason: check.reason }
  const norm = check.value

  const svc = pickService(ctx, 'userQuestions')
  if (!svc?.ask) {
    log('userQuestions 服务不可用，选项送不出去')
    return { ok: false, reason: 'userQuestions 服务不可用' }
  }
  const agent = world?.agent
  if (!agent) return { ok: false, reason: '没有可用的 agent（子代理里问不了人）' }

  try {
    const answer = await svc.ask({
      questions: [
        {
          id: 'reply-options',
          question: norm.question,
          header: norm.header,
          detail: norm.detail,
          options: norm.options,
          multiSelect: norm.multiSelect,
        },
      ],
      agent,
      signal: world?.signal,
    })
    const item = Array.isArray(answer?.answers) ? answer.answers[0] : null
    return {
      ok: true,
      picked: Array.isArray(item?.selected) ? item.selected.map(String) : [],
      custom: item?.custom ? String(item.custom) : undefined,
    }
  } catch (err) {
    log('询问失败：' + (err?.message ?? err))
    return { ok: false, reason: err?.code || err?.message || '提问失败' }
  }
}

/** 尽量拿到一个宿主服务：属性 → ctx.get → ctx.inject 三路兜底，绝不抛 */
function pickService(ctx, key) {
  try {
    const direct = ctx?.[key]
    if (direct) return direct
  } catch {
    /* ignore */
  }
  try {
    const viaGet = typeof ctx?.get === 'function' ? ctx.get(key) : undefined
    if (viaGet) return viaGet
  } catch {
    /* ignore */
  }
  try {
    let found
    if (typeof ctx?.inject === 'function') {
      ctx.inject([key], (inner) => {
        found = inner?.[key]
      })
    }
    return found
  } catch {
    /* ignore */
  }
  return undefined
}

const TOOL_DEF = {
  name: 'reply_options',
  description:
    '把「需要用户拍板的问题」变成可点的选项。两种典型用法：①执行中要问「是否继续/是否给权限」——只传 question，自动给「是/否」；②用户交代新任务——先把他的话解析成 2-4 个方案选项传进来，让他选完再动手。用户点选后你会收到一行回执。',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: '要问用户的问题，一句话' },
      options: {
        type: 'array',
        description: '2-6 个选项；省略则自动给「是，继续 / 不，先停」',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string', description: '按钮上的字，尽量短' },
            description: { type: 'string', description: '一句解释（可选）' },
          },
          required: ['label'],
          additionalProperties: false,
        },
      },
      header: { type: 'string', description: '可选短标题（≤12 字）' },
      detail: { type: 'string', description: '可选补充说明' },
      multiSelect: { type: 'boolean', description: '是否允许多选，默认否' },
    },
    required: ['question'],
    additionalProperties: false,
  },
  output: {
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        picked: { type: 'array', items: { type: 'string' } },
        custom: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['ok'],
    },
    render: (_args, out) => [{ type: 'text', text: formatAnswer(out) }],
  },
  execute: async (args, exec) => askOptions(TOOL_DEF.__ctx, exec, args),
}

export function apply(ctx, config = {}) {
  log(`apply v${VERSION}`)

  TOOL_DEF.__ctx = ctx

  let registered = false
  const register = (tools, via) => {
    if (registered || !tools?.register) return
    registered = true
    try {
      const dispose = tools.register(TOOL_DEF)
      log(`工具已注册：reply_options（来源 ${via}）`)
      if (typeof dispose === 'function') disposers.push(dispose)
    } catch (err) {
      log(`工具注册失败：${err?.message ?? err}`)
    }
  }
  const disposers = []

  // 三路兜底：直接属性 / ctx.inject / internal/service 事件
  try {
    const direct = ctx?.tools
    if (direct) register(direct, 'ctx.tools')
  } catch {
    /* ignore */
  }
  try {
    if (typeof ctx?.inject === 'function') {
      ctx.inject(['tools'], (inner) => register(inner?.tools, 'ctx.inject'))
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof ctx?.on === 'function') {
      ctx.on('internal/service', (svcName, value) => {
        if (svcName === 'tools' && value) register(value, 'internal/service')
      })
    }
  } catch {
    /* ignore */
  }

  return {
    dispose() {
      for (const d of disposers) {
        try {
          d()
        } catch {
          /* ignore */
        }
      }
      log('dispose')
    },
    // 给测试/调试
    __tool: TOOL_DEF,
    askOptions,
    normalizeAskArgs,
  }
}

export { formatAnswer, normalizeAskArgs, validateAsk } from './core.js'
