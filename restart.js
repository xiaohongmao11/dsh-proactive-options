/**
 * restart.js —— 把「自动重启 DSH」做成回复选项的一部分
 *
 * 为什么单独一个文件：重启是一段独立的、踩过坑的进程操作，跟选项逻辑无关；
 * 谁想用（本插件、宠物插件）直接 import 即可。
 *
 * 四个必须遵守的坑（都在真机上踩过）：
 *   ① PowerShell 5.1 读无 BOM 的 .ps1 会按 GBK 解析中文 → 脚本静默不执行。必须 UTF-8 BOM。
 *   ② 脚本路径不能有中文和空格（CIM 的 CommandLine 里加引号会被嵌套解析坏）。
 *   ③ CIM 里不要 `$null = Invoke-CimMethod`，用 `| Out-Null; exit 0`。
 *   ④ 脚本文件名必须唯一，否则连点两次会读到被覆盖的半截文件。
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEBOUNCE_MS = 60_000
let lastRestartAt = 0

export const RESTART_OPTION_LABEL = '重启'
export const KEEP_OPTION_LABEL = '不重启'

/**
 * 派发一次 DSH 重启：先 detach 一个 PowerShell，等一会儿再杀进程并重新拉起。
 * 返回 { ok, error? } —— 立刻返回，真正的重启在后台发生。
 */
export function restartDsh(log = () => {}) {
  if (Date.now() - lastRestartAt < DEBOUNCE_MS) {
    const waitS = Math.ceil((DEBOUNCE_MS - (Date.now() - lastRestartAt)) / 1000)
    log(`重启被防抖忽略（${waitS}s 内已派发过）`)
    return { ok: false, error: `刚刚已经派发过重启，请等 ${waitS} 秒再试` }
  }
  lastRestartAt = Date.now()

  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const scriptPath = join(tmpdir(), `dsh-restart-${stamp}.ps1`)
  const logPath = join(tmpdir(), `dsh-restart-${stamp}.log`).replace(/'/g, "''")

  const ps1 = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$log = '${logPath}'`,
    'function W([string]$m) { try { Add-Content -Path $log -Value ((Get-Date).ToString("s") + " " + $m) -Encoding utf8 } catch {} }',
    "W 'ps1 started'",
    'Start-Sleep -Milliseconds 900',
    "$procs = Get-Process -Name 'DeepSeek Harness'",
    '$main = $procs | Where-Object { $_.MainWindowHandle -ne 0 }',
    '$exe = ($main | Select-Object -First 1).Path',
    'if (-not $exe) { $exe = ($procs | Where-Object { $_.Path } | Select-Object -First 1).Path }',
    "$exeFallback = 'D:\\Users\\ASUS\\AppData\\Local\\Programs\\DeepSeek Harness\\DeepSeek Harness.exe'",
    'if (-not $exe) { $exe = $exeFallback }',
    "W ('main pid=' + (($main | Select-Object -First 1).Id) + ' count=' + $procs.Count)",
    'if ($main) { foreach ($m in $main) { try { & taskkill.exe /PID $m.Id /F /T | Out-Null } catch {} } }',
    'Start-Sleep -Milliseconds 1200',
    "$left = Get-Process -Name 'DeepSeek Harness'",
    "W ('after tree kill, left=' + $left.Count)",
    'if ($left) { foreach ($g in $left) { try { & taskkill.exe /PID $g.Id /F /T | Out-Null } catch {} } }',
    'Start-Sleep -Milliseconds 1200',
    "W 'killed, starting'",
    'if (Test-Path $exe) {',
    '  try {',
    "    $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ('\"' + $exe + '\"') }",
    "    W ('started rc=' + $r.ReturnValue + ' pid=' + $r.ProcessId)",
    '  } catch { W ("start error " + $_.Exception.Message) }',
    '} else { W ("exe missing " + $exe) }',
    'Start-Sleep -Milliseconds 3000',
    'try { Remove-Item -LiteralPath $PSCommandPath -Force -ErrorAction SilentlyContinue } catch {}',
  ].join('\r\n')

  try {
    writeFileSync(scriptPath, '\uFEFF' + ps1, 'utf8')
    appendFileSync(logPath, `[${new Date().toISOString()}] restart requested\n`)
  } catch (err) {
    return { ok: false, error: '写重启脚本失败：' + (err?.message ?? err) }
  }

  try {
    // 同步 execFileSync：spawn+unref 是异步的，宿主可能在 powershell 走到 CIM 之前就被回收。
    const launcher = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ${scriptPath}`
    const cimCmd = `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${launcher.replace(/'/g, "''")}' } | Out-Null; exit 0`
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cimCmd],
      { timeout: 15000, windowsHide: true, encoding: 'utf8' },
    )
    log('已派发重启进程（经 CIM）')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: '派发重启失败：' + (err?.message ?? err) }
  }
}

/** 判断用户点的是不是「重启」 */
export function isRestartPick(picked) {
  const list = Array.isArray(picked) ? picked : []
  return list.some((p) => String(p).trim() === RESTART_OPTION_LABEL)
}
