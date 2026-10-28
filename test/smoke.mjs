/**
 * test/smoke.mjs —— 自检：工具注册、参数规范化、是否继续的默认选项、回执格式
 * 跑法：node test/smoke.mjs
 */

import { apply, askOptions, formatAnswer, normalizeAskArgs, validateAsk } from '../index.js'

let pass = 0
let fail = 0
function ok(name, cond, extra) {
  if (cond) {
    pass += 1
    console.log('  ✓ ' + name)
  } else {
    fail += 1
    console.log('  ✗ ' + name + (extra !== undefined ? ' → ' + JSON.stringify(extra) : ''))
  }
}

console.log('\n[1] 参数规范化')
{
  const y = normalizeAskArgs({ question: '还继续吗' })
  ok('只给问题 → 自动补是/否', y.options.length === 2 && y.options[0].label === '是，继续')
  const two = normalizeAskArgs({ question: '选哪个', options: [{ label: 'A' }, { label: 'B' }] })
  ok('显式选项原样保留', two.options.map((o) => o.label).join(',') === 'A,B')
  const one = normalizeAskArgs({ question: '选哪个', options: [{ label: '只有这一个' }] })
  ok('只有一个选项时补一个停', one.options.length === 2)
  const dup = validateAsk({ question: '选哪个', options: [{ label: 'A' }, { label: 'A' }] })
  ok('重复选项被拒', dup.ok === false)
  const empty = validateAsk({ question: '' })
  ok('空问题被拒', empty.ok === false)
  ok('header 截到 12 字', normalizeAskArgs({ question: 'x', header: '一二三四五六七八九十甲乙丙' }).header.length <= 12)
}

console.log('\n[2] 回执格式')
{
  ok('选中回执', formatAnswer({ ok: true, picked: ['是，继续'] }) === '[用户选了：是，继续]')
  ok('自定义回执', formatAnswer({ ok: true, picked: [], custom: '都行' }) === '[用户选了：都行]')
  ok('失败回执', /选项未送达/.test(formatAnswer({ ok: false, reason: '服务不可用' })))
}

console.log('\n[3] 服务不可用时只降级')
{
  const res = await askOptions({}, {}, { question: '还继续吗' })
  ok('没有 userQuestions → ok:false 且不抛', res.ok === false && !!res.reason)
  const res2 = await askOptions({ userQuestions: { ask: async () => ({}) } }, {}, { question: '还继续吗' })
  ok('没有 agent → ok:false', res2.ok === false)
}

console.log('\n[4] 正常询问 + 工具注册')
{
  const calls = []
  const ctx = {
    userQuestions: {
      ask: async (payload) => {
        calls.push(payload)
        return { answers: [{ selected: ['是，继续'] }] }
      },
    },
    tools: {
      register: (def) => {
        tools.push(def)
        return () => {}
      },
    },
  }
  const tools = []
  const api = apply(ctx, {})
  ok('工具已注册', tools.length === 1 && tools[0].name === 'reply_options')

  const out = await tools[0].execute({ question: '这个方案继续做吗' }, { agent: { id: 'a' } })
  ok('执行返回用户选择', out.ok === true && out.picked[0] === '是，继续')
  ok('询问带了默认是/否选项', calls.length === 1 && calls[0].questions[0].options.length === 2)
  ok('问题原样传给宿主', calls[0].questions[0].question === '这个方案继续做吗')

  const rendered = tools[0].output.render({}, out)
  ok('回执文本可用', rendered[0].text === '[用户选了：是，继续]')

  api.dispose()
  ok('dispose 不抛', true)
}

console.log('\n[5] 没有 tools 服务时 entry 不炸')
{
  let threw = false
  try {
    apply({}, {})
  } catch {
    threw = true
  }
  ok('apply 不抛错', threw === false)
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`)
if (fail) process.exitCode = 1
