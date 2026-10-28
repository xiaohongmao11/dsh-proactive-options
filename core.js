/**
 * dsh-proactive-options/core.js —— 纯逻辑，不依赖宿主
 *
 * 为什么单独拆出来：
 *   - DSH 独立跑（host 插件）和装进宠物（dsh-pet）都要用同一套「问题 + 选项」的
 *     规范化与回执格式，逻辑只能有一份，否则两边行为会慢慢走偏。
 *   - 这里不 import 任何宿主模块，所以浏览器/测试/宠物都能安全引用。
 */

/** 场景一（是否继续 / 要权限）的默认选项：调用方只给问题，不给选项也能用 */
export const DEFAULT_YES_NO = [
  { label: '是，继续', description: '按现在的做法做下去' },
  { label: '不，先停', description: '暂停，等你再说' },
]

const MAX_OPTIONS = 6

/**
 * 规范化一次询问参数。
 * @param {object} args
 * @param {string} args.question 必填，一句话
 * @param {Array<{label:string,description?:string}>} [args.options] 2-6 个；省略则用「是/否」
 * @param {string} [args.header] 短标题（≤12 字）
 * @param {string} [args.detail] 补充说明
 * @param {boolean} [args.multiSelect] 是否多选
 * @returns {{question:string, options:Array<{label:string,description?:string}>, header?:string, detail?:string, multiSelect:boolean}}
 */
export function normalizeAskArgs(args = {}) {
  const question = String(args?.question ?? '').trim()
  const raw = Array.isArray(args?.options) ? args.options : []
  let options = raw
    .map((o) => ({
      label: String(o?.label ?? '').trim(),
      description: o?.description ? String(o.description).trim() : undefined,
    }))
    .filter((o) => o.label)
    .slice(0, MAX_OPTIONS)

  // 只给问题、不给选项 = 场景一（是否继续），自动补「是/否」
  if (!options.length) options = DEFAULT_YES_NO.map((o) => ({ ...o }))

  // 只有一个选项时补一个「不，先停」，保证「选择」这个动作成立
  if (options.length === 1) {
    options.push({ label: '不，先停', description: '暂停，等你再说' })
  }

  return {
    question,
    options,
    header: args?.header ? String(args.header).slice(0, 12) : undefined,
    detail: args?.detail ? String(args.detail) : undefined,
    multiSelect: args?.multiSelect === true,
  }
}

/**
 * 把用户的选择压成一行给模型看的回执。
 * 例：[用户选了：是，继续]
 */
export function formatAnswer(out) {
  if (!out || out.ok !== true) {
    return `[选项未送达：${out?.reason || '未知原因'}]`
  }
  const picked = Array.isArray(out.picked) ? out.picked.filter(Boolean) : []
  const custom = out.custom ? String(out.custom).trim() : ''
  const text = picked.length ? picked.join('、') : custom
  return `[用户选了：${text || '（未选）'}]`
}

/**
 * 校验一次询问是否值得弹给用户：
 * 没问题的、选项重复的、选项全是空白的都直接拒掉，避免弹出一个没得选的框。
 */
export function validateAsk(args = {}) {
  const norm = normalizeAskArgs(args)
  if (!norm.question) return { ok: false, reason: '问题为空' }
  const uniq = new Set(norm.options.map((o) => o.label))
  if (uniq.size < 2) return { ok: false, reason: '至少要有两个不同的选项' }
  return { ok: true, value: norm }
}
