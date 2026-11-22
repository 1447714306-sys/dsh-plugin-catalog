import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { CATEGORIES, CURATED, TOOL_OWNERS, TOOL_PREFIXES } from './catalog.js'
import { buildDocx } from './docx.js'

export const inject = ['tools']

const SELF = 'dsh-plugin-catalog'
const ROUTE = '/dsh-plugin-catalog'

const STRING_OUTPUT = {
  schema: { type: 'string' },
  render: (_args, value) => [{ type: 'text', text: value }],
}

const OTHER = '其他插件'

// --- usage statistics -----------------------------------------------------
// 「调用 N 次 · 占插件调用 P%」的数字来自 DSH 自己写的会话日志：
//   $DSH_HOME/sessions/<workspace>/<session>/session.v4.jsonl.zstd
// 每行一个事件，type="tool/call" 的就是一次工具调用。日志是追加写的 zstd **多帧**
// 文件，node 的 zstdDecompressSync 只解第一帧（其余帧被当成尾部垃圾），所以这里自己
// 按 magic 切帧、逐帧解压再拼接。
//
// 归属是个真问题：工具定义里没有来源字段（dsh-tools 的 register() 只存
// {definition, when}，契约里没有 provenance/origin），pluginManager 的 listBundles /
// readBundleDetail 也不提供「这个插件注册了哪些工具」。所以归属来自 catalog.js 的
// TOOL_OWNERS / TOOL_PREFIXES —— 一张人工核过的表（证据见 tool_owners.json）。
// 宁可留空也不猜：认不出归属的调用计入「其它」，绝不摊给任何插件；面板页脚会写明覆盖比例。
const USAGE_TTL_MS = 10 * 60 * 1000
const USAGE_MAX_FILES = 400
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
const usageCache = { at: 0, data: null, pending: null, files: new Map() }

/** 解出所有 zstd 帧：先列出每个 magic 的起点，再让每帧的终点向后试探到能解压为止。 */
function decodeZstdFrames(buffer) {
  const starts = []
  for (let cursor = 0; ; ) {
    const hit = buffer.indexOf(ZSTD_MAGIC, cursor)
    if (hit < 0) break
    starts.push(hit)
    cursor = hit + 1
  }
  if (starts.length === 0) return ''
  const parts = []
  let index = 0
  while (index < starts.length) {
    let decoded = false
    for (let end = index + 1; end <= starts.length; end += 1) {
      const stop = end < starts.length ? starts[end] : buffer.length
      try {
        parts.push(zlib.zstdDecompressSync(buffer.subarray(starts[index], stop)).toString('utf8'))
        index = end
        decoded = true
        break
      } catch {
        // 这一帧还没到真正的结尾，把终点往后延
      }
    }
    if (!decoded) break
  }
  return parts.join('')
}

function sessionRoots() {
  const roots = []
  if (process.env.DSH_HOME) roots.push(path.join(process.env.DSH_HOME, 'sessions'))
  const home = path.join(os.homedir(), '.dsh', 'sessions')
  if (!roots.includes(home)) roots.push(home)
  return roots
}

function listSessionFiles() {
  const files = []
  for (const root of sessionRoots()) {
    let workspaces = []
    try {
      workspaces = fs.readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const workspace of workspaces) {
      if (!workspace.isDirectory()) continue
      const workspaceDir = path.join(root, workspace.name)
      let sessions = []
      try {
        sessions = fs.readdirSync(workspaceDir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const session of sessions) {
        if (!session.isDirectory()) continue
        const sessionDir = path.join(workspaceDir, session.name)
        let entries = []
        try {
          entries = fs.readdirSync(sessionDir, { withFileTypes: true })
        } catch {
          continue
        }
        for (const entry of entries) {
          if (!entry.isFile()) continue
          if (!/^session.*\.jsonl(\.zstd)?$/iu.test(entry.name)) continue
          files.push(path.join(sessionDir, entry.name))
        }
      }
    }
  }
  files.sort()
  return files
}

/** 一个会话文件 → {calls,lastAt} 的 Map；按 size+mtime 缓存，没变过就不重解。 */
function readSessionFile(file) {
  const stat = fs.statSync(file)
  const cached = usageCache.files.get(file)
  if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached
  const raw = fs.readFileSync(file)
  const text = ZSTD_MAGIC.length > 0 && raw.subarray(0, 4).equals(ZSTD_MAGIC)
    ? decodeZstdFrames(raw)
    : raw.toString('utf8')
  const counts = new Map()
  for (const line of text.split('\n')) {
    if (!line || line.indexOf('tool/call') < 0) continue
    let event = null
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (!event || event.type !== 'tool/call') continue
    const name = event.data && event.data.name
    if (!name) continue
    const at = Number(event.time) || 0
    const item = counts.get(name) || { calls: 0, lastAt: 0 }
    item.calls += 1
    if (at > item.lastAt) item.lastAt = at
    counts.set(name, item)
  }
  const record = { size: stat.size, mtimeMs: stat.mtimeMs, counts, bytes: raw.length }
  usageCache.files.set(file, record)
  return record
}

async function scanUsage(force = false) {
  if (!force && usageCache.data && Date.now() - usageCache.at < USAGE_TTL_MS) return usageCache.data
  if (usageCache.pending) return usageCache.pending
  usageCache.pending = (async () => {
    const files = listSessionFiles().slice(0, USAGE_MAX_FILES)
    const live = new Set(files)
    for (const known of [...usageCache.files.keys()]) if (!live.has(known)) usageCache.files.delete(known)
    const byTool = new Map()
    let bytes = 0
    for (const file of files) {
      let record = null
      try {
        record = readSessionFile(file)
      } catch {
        continue
      }
      bytes += record.bytes
      for (const [name, item] of record.counts) {
        const acc = byTool.get(name) || { calls: 0, lastAt: 0 }
        acc.calls += item.calls
        if (item.lastAt > acc.lastAt) acc.lastAt = item.lastAt
        byTool.set(name, acc)
      }
    }
    const data = { at: Date.now(), files: files.length, bytes, byTool }
    usageCache.at = data.at
    usageCache.data = data
    return data
  })()
  try {
    return await usageCache.pending
  } finally {
    usageCache.pending = null
  }
}

function ownerOf(tool) {
  if (TOOL_OWNERS[tool]) return TOOL_OWNERS[tool]
  for (const [prefix, pkg] of TOOL_PREFIXES) if (tool.startsWith(prefix)) return pkg
  return null
}

function usageByPackage(data) {
  const byPackage = new Map()
  let total = 0
  let attributed = 0
  const stray = []
  for (const [tool, item] of data.byTool) {
    total += item.calls
    const owner = ownerOf(tool)
    if (!owner) {
      stray.push({ name: tool, calls: item.calls, lastAt: item.lastAt })
      continue
    }
    attributed += item.calls
    const acc = byPackage.get(owner) || { calls: 0, lastAt: 0, tools: [] }
    acc.calls += item.calls
    if (item.lastAt > acc.lastAt) acc.lastAt = item.lastAt
    acc.tools.push({ name: tool, calls: item.calls, lastAt: item.lastAt })
    byPackage.set(owner, acc)
  }
  for (const acc of byPackage.values()) acc.tools.sort((a, b) => b.calls - a.calls)
  stray.sort((a, b) => b.calls - a.calls)
  return { byPackage, total, attributed, stray }
}

async function usageSummary(force = false) {
  try {
    const data = await scanUsage(force)
    const aggregates = usageByPackage(data)
    return { at: data.at, files: data.files, bytes: data.bytes, ...aggregates }
  } catch (error) {
    return {
      at: Date.now(),
      files: 0,
      bytes: 0,
      byPackage: new Map(),
      total: 0,
      attributed: 0,
      stray: [],
      error: String((error && error.message) || error),
    }
  }
}

function share(part, whole) {
  if (!whole) return 0
  return Math.round((part / whole) * 1000) / 10
}

function usageMeta(summary) {
  return {
    at: new Date(summary.at).toISOString(),
    sessions: summary.files,
    calls: summary.total,
    attributed: summary.attributed,
    coverage: share(summary.attributed, summary.total),
    strayCalls: summary.total - summary.attributed,
    error: summary.error || null,
  }
}

/** 把每个插件的用量贴到行上：主占比用「插件调用合计」做分母（插件之间可比），
 *  另给一个占全部工具调用的比例。 */
function applyUsage(rows, summary) {
  if (!summary) return rows
  for (const row of rows) {
    const acc = summary.byPackage.get(row.name)
    if (!acc) {
      row.usage = {
        calls: 0,
        share: 0,
        shareAll: 0,
        lastAt: null,
        tools: [],
        known: false,
      }
      continue
    }
    row.usage = {
      calls: acc.calls,
      share: share(acc.calls, summary.attributed),
      shareAll: share(acc.calls, summary.total),
      lastAt: acc.lastAt ? new Date(acc.lastAt).toISOString() : null,
      tools: acc.tools.slice(0, 12),
      known: true,
    }
  }
  return rows
}

function usagePayload(summary) {
  const meta = usageMeta(summary)
  const packages = [...summary.byPackage.entries()]
    .map(([name, acc]) => ({
      name,
      calls: acc.calls,
      share: share(acc.calls, summary.attributed),
      shareAll: share(acc.calls, summary.total),
      lastAt: acc.lastAt ? new Date(acc.lastAt).toISOString() : null,
      tools: acc.tools,
    }))
    .sort((a, b) => b.calls - a.calls)
  return {
    ok: true,
    ...meta,
    packages,
    unattributedTop: summary.stray.slice(0, 15),
  }
}

// --- document export ------------------------------------------------------
// 「一键导出」：把当前清单排成一份 Word（真的 .docx，本模块自己写 OOXML），
// 需要 PDF 时再借 DSH 自带的那套 LibreOffice（@deepseek-ai/libreoffice-kit）
// 转一次。两件事都不改动 profile，只往导出目录里写文件。

// 导出落在桌面上：那是用户一眼能找到的地方。以前写在 ~/.dsh/exports 里，下载路由
// 仍然认那个旧目录，免得升级后旧文件点不开。
const LEGACY_EXPORT_DIR = path.join(os.homedir(), '.dsh', 'exports', 'plugin-catalog')

function desktopDir() {
  const home = os.homedir()
  for (const dir of [path.join(home, 'Desktop'), path.join(home, 'OneDrive', 'Desktop'), path.join(home, '桌面')]) {
    try {
      if (fs.statSync(dir).isDirectory()) return dir
    } catch {
      // not this one
    }
  }
  return LEGACY_EXPORT_DIR
}

const EXPORT_DIR = desktopDir()
const EXPORT_DIRS = [...new Set([EXPORT_DIR, LEGACY_EXPORT_DIR])]
const EXPORT_NAME = 'DeepSeek Harness 插件使用清单'

let kitPromise = null

/** Candidate locations of the LibreOffice kit shipped with DSH. */
function kitCandidates() {
  const roots = []
  const push = (value) => {
    if (value && !roots.includes(value)) roots.push(value)
  }
  try {
    push(process.resourcesPath)
  } catch {
    // not Electron
  }
  try {
    push(path.join(path.dirname(process.execPath), 'resources'))
  } catch {
    // no execPath
  }
  const bases = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'DeepSeek Harness', 'resources'),
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'deepseek-harness', 'resources'),
    '/Applications/DeepSeek Harness.app/Contents/Resources',
    '/opt/DeepSeek Harness/resources',
  ]
  for (const dir of [process.env.LOCALAPPDATA, process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (dir) bases.push(path.join(dir, 'Programs', 'DeepSeek Harness', 'resources'))
    if (dir) bases.push(path.join(dir, 'DeepSeek Harness', 'resources'))
  }
  for (const base of bases) push(base)
  const out = []
  // An explicit override wins: it also makes the conversion testable outside Electron.
  if (process.env.DSH_LIBREOFFICE_KIT) out.push(process.env.DSH_LIBREOFFICE_KIT)
  for (const root of roots) {
    out.push(path.join(root, 'app.asar.unpacked', 'dsh', 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'lib', 'index.js'))
    out.push(path.join(root, 'dsh', 'node_modules', '@deepseek-ai', 'libreoffice-kit', 'lib', 'index.js'))
  }
  return out
}

async function loadKit() {
  if (kitPromise) return kitPromise
  kitPromise = (async () => {
    for (const candidate of kitCandidates()) {
      try {
        if (!fs.existsSync(candidate)) continue
        const mod = await import(pathToFileURL(candidate))
        if (typeof mod.createConverter === 'function') return mod
      } catch {
        // try the next candidate
      }
    }
    return null
  })()
  return kitPromise
}

function pathToFileURL(file) {
  const normalised = path.resolve(file).replace(/\\/gu, '/')
  return `file:///${normalised.replace(/^\//u, '')}`
}

function stamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

function localTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (input) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function clip(text, limit) {
  const value = String(text || '').replace(/\s+/gu, ' ').trim()
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value
}

/** The Word document model: cover-ish head, per-category tables, method notes. */
function exportModel(rows, usage, extras) {
  const meta = usage ? usageMeta(usage) : null
  const groups = new Map()
  for (const category of CATEGORIES) groups.set(category, [])
  for (const row of rows) {
    const key = groups.has(row.category) ? row.category : OTHER
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }

  const blocks = [
    { type: 'title', text: EXPORT_NAME },
    {
      type: 'subtitle',
      text: `生成时间 ${localTime(new Date())} · 共 ${rows.length} 个插件 · ${groups.size} 个大类${
        extras.length ? `（另有 ${extras.length} 个官方核心包随 DSH 安装，不在 profile 目录里）` : ''
      }`,
    },
    {
      type: 'para',
      text:
        '本清单列出当前 profile 真正声明的插件：它做什么、怎么用、往宿主里挂了什么，以及在最近的本机会话里被工具调用了多少次。' +
        '数据来自 profile 的 dsh.profile.bundles、各包的 cordis.patch.yml 与 README，以及 $DSH_HOME/sessions 下的会话日志。',
    },
  ]

  if (meta) {
    blocks.push({ type: 'heading', text: '使用概览' })
    blocks.push({
      type: 'bullet',
      text: `会话日志 ${meta.sessions} 个文件，共 ${meta.calls} 次工具调用；其中 ${meta.attributed} 次（${meta.coverage}%）能确定归属到插件。`,
    })
    blocks.push({
      type: 'bullet',
      text: `其余 ${meta.strayCalls} 次是 DSH 内置工具或还没有登记归属的插件工具，不计入任何插件——宁可少算，也不摊派。`,
    })
    blocks.push({ type: 'bullet', text: `统计截至 ${localTime(meta.at)}（面板与本文件都按 10 分钟缓存重算）。` })
    const ranked = [...usage.byPackage.entries()].sort((a, b) => b[1].calls - a[1].calls).slice(0, 6)
    if (ranked.length) {
      blocks.push({ type: 'para', text: '调用最多的插件：', spaceAfter: 60 })
      for (const [name, acc] of ranked) {
        blocks.push({
          type: 'bullet',
          text: `${name} — ${acc.calls} 次（占插件调用 ${share(acc.calls, meta.attributed)}%，占全部工具调用 ${share(acc.calls, meta.calls)}%）`,
        })
      }
    }
  } else {
    blocks.push({ type: 'note', text: '本次没能读到会话日志，文件里不含使用统计（作用与用法不受影响）。' })
  }

  const columns = [{ width: 2500 }, { width: 3300 }, { width: 2800 }, { width: 1000 }]
  const header = ['插件', '作用', '怎么用', '使用']

  for (const [category, list] of groups) {
    if (!list.length) continue
    blocks.push({ type: 'heading', text: `${category}（${list.length}）` })
    const tableRows = list.map((row) => {
      const lines = [{ runs: [[row.title || row.name, { bold: true }]] }]
      if (row.version) lines.push({ runs: [[`v${row.version}`, { size: 16, color: '667085' }]] })
      if (row.title && row.title !== row.name) lines.push({ runs: [[row.name, { size: 15, color: '98A2B3' }]] })
      const how = row.how || (row.readme && row.readme.text) || '—'
      const used = row.usage && row.usage.calls > 0
      return [
        lines,
        clip(row.purpose, 180) || '—',
        clip(how, row.how ? 220 : 200),
        used ? `${row.usage.calls} 次\n${row.usage.share}%` : '—',
      ]
    })
    blocks.push({ type: 'table', columns, header, rows: tableRows })
  }

  blocks.push({ type: 'pagebreak' })
  blocks.push({ type: 'heading', text: '统计口径' })
  blocks.push({
    type: 'para',
    text:
      '只统计会话日志里的 tool/call 事件，不含斜杠命令、skill 调用与纯聊天轮次；「占插件调用」的分母是所有能确定归属的调用，' +
      '「占全部工具调用」的分母包含内置工具，因此前一列适合横向比较插件，后一列说明它在全部动作里的份量。',
  })
  if (meta && Array.isArray(usage.stray)) {
    const top = [...usage.stray].sort((a, b) => b.calls - a.calls).slice(0, 10)
    if (top.length) {
      blocks.push({ type: 'para', text: '未归属的调用（DSH 内置工具或未登记归属的插件工具）：', spaceAfter: 60 })
      blocks.push({
        type: 'table',
        columns: [{ width: 4000 }, { width: 1800 }, { width: 1800 }],
        header: ['工具', '调用次数', '占全部工具调用'],
        rows: top.map((item) => [item.name, String(item.calls), `${share(item.calls, meta.calls)}%`]),
      })
    }
  }
  blocks.push({
    type: 'note',
    text:
      '归属来自本插件内置的映射表（tool_owners.json → catalog.js 的 TOOL_OWNERS / TOOL_PREFIXES，人工核对过）。' +
      'DSH 的工具定义不带「属于哪个插件」的元数据，所以映射不到的调用一律记进未归属。',
  })
  blocks.push({
    type: 'note',
    text: `本文件由 dsh-plugin-catalog v${PLUGIN_VERSION} 生成；重新导出一份即可刷新数字，导出的文件不会改动任何插件。`,
  })

  return { title: EXPORT_NAME, author: 'dsh-plugin-catalog', blocks }
}

const PLUGIN_VERSION = (() => {
  try {
    const manifest = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    return manifest.version || '0'
  } catch {
    return '0'
  }
})()

/** Write the .docx and (optionally) convert it to PDF with the bundled LibreOffice. */
async function exportCatalog(options = {}) {
  const format = options.format === 'pdf' ? 'pdf' : 'docx'
  const targetDir = options.dir ? path.resolve(String(options.dir)) : EXPORT_DIR
  const usage = await usageSummary(Boolean(options.force))
  const { rows, extras } = joined()
  applyUsage(rows, usage)
  const model = exportModel(rows, usage, extras.includes(SELF) ? extras.filter((name) => name !== SELF) : extras)
  const buffer = buildDocx(model)

  fs.mkdirSync(targetDir, { recursive: true })
  const base = `${EXPORT_NAME}-${stamp()}`

  // 同一秒里连导两次也不能互相覆盖，所以目标名往后顺延。
  const unique = (ext) => {
    let name = `${base}.${ext}`
    let n = 1
    while (fs.existsSync(path.join(targetDir, name))) {
      n += 1
      name = `${base}-${n}.${ext}`
    }
    return path.join(targetDir, name)
  }

  if (format === 'docx') {
    const docxPath = unique('docx')
    fs.writeFileSync(docxPath, buffer)
    return {
      ok: true,
      format: 'docx',
      dir: targetDir,
      docx: { path: docxPath, name: path.basename(docxPath), bytes: buffer.length },
      pdf: null,
      note: '',
    }
  }

  // 选 PDF：中间的 Word 只落在系统临时目录（不进桌面），转完把整个临时目录删掉，
  // 所以桌面上只会出现一份 PDF。想要 Word，就再按 Word 导一次。
  const pdfPath = unique('pdf')
  const result = { ok: true, format: 'pdf', dir: targetDir, docx: null, pdf: null, note: '' }
  const kit = await loadKit()
  if (!kit) {
    const docxPath = unique('docx')
    fs.writeFileSync(docxPath, buffer)
    result.docx = { path: docxPath, name: path.basename(docxPath), bytes: buffer.length }
    result.format = 'docx'
    result.note =
      '导出为 Word 成功，但没找到 DSH 自带的 LibreOffice，无法转 PDF：可以先给 Word（Word 里另存为 PDF 一样），或升级 DSH 后重试。'
    return result
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-plugin-catalog-'))
  const tmpDocx = path.join(tmpDir, 'catalog.docx')
  fs.writeFileSync(tmpDocx, buffer)
  try {
    const converter = await kit.createConverter({})
    try {
      const converted = await converter.convert({ inputPath: tmpDocx, outputPath: pdfPath })
      result.pdf = {
        path: pdfPath,
        name: path.basename(pdfPath),
        bytes: fs.existsSync(pdfPath) ? fs.statSync(pdfPath).size : 0,
        pages: converted && converted.pageCount,
        missingFonts: (converted && converted.missingFonts) || [],
      }
      if (result.pdf.missingFonts.length) {
        result.note = `PDF 已生成；以下字体本机没有，用了替代字体：${result.pdf.missingFonts.join('、')}。`
      }
      result.note = (result.note ? result.note + ' ' : '') + '已按所选格式只保留 PDF。'
    } finally {
      await converter.dispose().catch(() => {})
    }
  } catch (error) {
    // 转不出来就别让用户两手空空：退回 Word。
    const docxPath = unique('docx')
    fs.writeFileSync(docxPath, buffer)
    result.docx = { path: docxPath, name: path.basename(docxPath), bytes: buffer.length }
    result.format = 'docx'
    result.note = `转 PDF 失败（${String(error && error.message ? error.message : error)}）；已经给你 Word，可以用 Word 打开后另存为 PDF。`
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {}
  }

  return result
}

let exportBusy = false

async function handleExport(req, res) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, JSON.stringify({ ok: false, error: { code: 'local-only', diagnostic: '只接受本机回环请求' } }))
    return
  }
  let body = null
  try {
    body = JSON.parse((await readBody(req)) || '{}')
  } catch {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'bad-json', diagnostic: '请求体不是合法 JSON' } }))
    return
  }
  const format = body && body.format === 'pdf' ? 'pdf' : 'docx'
  if (body && body.confirm !== true) {
    sendJson(
      res,
      400,
      JSON.stringify({
        ok: false,
        error: {
          code: 'confirm-required',
          diagnostic: `导出会在 ${EXPORT_DIR} 写一份 ${format.toUpperCase()} 文件，需要 confirm: true`,
        },
      }),
    )
    return
  }
  if (exportBusy) {
    sendJson(
      res,
      429,
      JSON.stringify({ ok: false, error: { code: 'export-busy', diagnostic: '上一次导出还没结束，等它写完再点' } }),
    )
    return
  }
  exportBusy = true
  try {
    const result = await exportCatalog({ format, dir: body && body.dir, force: body && body.force === true })
    sendJson(res, 200, JSON.stringify(result))
  } catch (error) {
    sendJson(
      res,
      500,
      JSON.stringify({ ok: false, error: { code: 'export-failed', diagnostic: String(error && error.message ? error.message : error) } }),
    )
  } finally {
    exportBusy = false
  }
}

/** Serve a file that this plugin wrote, so the panel can offer a download link. */
function handleExportDownload(req, res, url) {
  const name = String(url?.searchParams?.get('file') || '')
  const safe = path.basename(name)
  if (!safe || safe !== name || !/\.(docx|pdf)$/iu.test(safe)) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'bad-file', diagnostic: '文件名不合法' } }))
    return
  }
  let file = ''
  for (const dir of EXPORT_DIRS) {
    const candidate = path.join(dir, safe)
    if (fs.existsSync(candidate)) {
      file = candidate
      break
    }
  }
  if (!file) {
    sendJson(res, 404, JSON.stringify({ ok: false, error: { code: 'unknown-file', diagnostic: '导出目录里没有这个文件' } }))
    return
  }
  const type = /\.pdf$/iu.test(safe)
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  res.statusCode = 200
  res.setHeader('content-type', type)
  res.setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safe)}`)
  res.setHeader('cache-control', 'no-store')
  fs.createReadStream(file).pipe(res)
}

// --- update check ---------------------------------------------------------
// Read-only: ask the npm registry for each plugin's published `latest` and
// compare it with what is installed. Nothing is ever written to disk here; the
// actual install stays with the plugin manager / market, which know how to back
// up, roll back and restart.
const REGISTRY = 'https://registry.npmjs.org'
const UPDATE_TTL_MS = 6 * 60 * 60 * 1000
const updateCache = new Map()

// Updating is a write operation, so it goes through the Host's own plugin manager
// (`pluginManager.updateBundle`) instead of shelling out to pnpm ourselves: that
// service already owns removal, install, restore-on-failure and restart semantics.
const managerHolder = { pm: null }
// Updating and removing both rewrite the profile manifest, so one package may hold
// only one of them at a time: the manager's own install lock would reject the second.
const WRITE_INFLIGHT = new Set()
const MAX_BODY = 64 * 1024
// `pluginManager.listBundles()` is the only honest source for "can this be removed"
// and "is it actually selected"; it is a Host round trip, so keep it for a moment.
const BUNDLES_TTL_MS = 15 * 1000
const bundlesCache = { at: 0, map: new Map(), error: null, pending: null }
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/iu
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/iu

function capturePluginManager(ctx) {
  try {
    ctx.inject(['pluginManager'], (scope) => {
      const pm = scope?.pluginManager ?? scope?.get?.('pluginManager') ?? null
      managerHolder.pm = pm && typeof pm.updateBundle === 'function' ? pm : null
      bundlesCache.at = 0
      return () => {
        managerHolder.pm = null
      }
    })
  } catch {
    // Host without the manager service: the panel stays read-only and says so.
  }
}

// What the Host says about each bundle: removable, official, optional, selected.
// Failures are swallowed into an empty map — a missing service must not break the list.
async function bundlesInfo(force) {
  const now = Date.now()
  if (!force && bundlesCache.map.size > 0 && now - bundlesCache.at < BUNDLES_TTL_MS) return bundlesCache.map
  if (!force && bundlesCache.error && now - bundlesCache.at < BUNDLES_TTL_MS) return bundlesCache.map
  if (bundlesCache.pending) return bundlesCache.pending
  const pm = managerHolder.pm
  if (!pm || typeof pm.listBundles !== 'function') {
    bundlesCache.at = now
    bundlesCache.error = 'no-listBundles'
    return bundlesCache.map
  }
  bundlesCache.pending = (async () => {
    try {
      const list = await pm.listBundles()
      const map = new Map()
      for (const item of Array.isArray(list) ? list : []) {
        if (!item || typeof item.name !== 'string') continue
        map.set(item.name, {
          removable: item.removable === true,
          official: item.official === true,
          optional: item.optional === true,
          enabled: item.enabled === true,
          installed: item.installed === true,
          availability: item.availability || '',
          update: item.update || null,
          readOnlyReason: item.readOnlyReason || null,
          source: item.source || '',
        })
      }
      bundlesCache.map = map
      bundlesCache.error = null
      bundlesCache.at = Date.now()
    } catch (error) {
      bundlesCache.at = Date.now()
      bundlesCache.error = String(error?.message || error)
    } finally {
      bundlesCache.pending = null
    }
    return bundlesCache.map
  })()
  return bundlesCache.pending
}

function versionParts(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/u.exec(String(value || '').trim())
  if (!match) return null
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] || '' }
}

function compareVersions(a, b) {
  const left = versionParts(a)
  const right = versionParts(b)
  if (!left || !right) return 0
  for (let index = 0; index < 3; index += 1) {
    if (left.core[index] !== right.core[index]) return left.core[index] > right.core[index] ? 1 : -1
  }
  if (left.pre === right.pre) return 0
  if (!left.pre) return 1
  if (!right.pre) return -1
  return left.pre > right.pre ? 1 : -1
}

function registryLatestUrl(name) {
  return `${REGISTRY}/${String(name).replace('/', '%2F')}/latest`
}

async function npmLatest(name, force) {
  const hit = updateCache.get(name)
  if (!force && hit && Date.now() - hit.at < UPDATE_TTL_MS) return hit
  const entry = { at: Date.now(), version: null, error: null, absent: false }
  try {
    const res = await fetch(registryLatestUrl(name), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(9000),
    })
    if (res.status === 404) {
      entry.absent = true
    } else if (!res.ok) {
      entry.error = `npm registry HTTP ${res.status}`
    } else {
      const doc = await res.json()
      entry.version = String(doc?.version || '') || null
      if (!entry.version) entry.error = 'npm registry: no version'
    }
  } catch (error) {
    entry.error = String(error?.message || error)
  }
  updateCache.set(name, entry)
  return entry
}

function isLinkedPackage(dir) {
  try {
    return fs.lstatSync(dir).isSymbolicLink()
  } catch {
    return false
  }
}

const packumentCache = new Map()

/**
 * Every published version of a package, newest first, so the panel can walk back.
 * The plugin manager's own `listVersions` only lists versions NEWER than the installed
 * one, which cannot answer "把 dsh-ppt 退回 0.35.0".
 */
async function npmVersions(name, force = false) {
  const key = String(name)
  const hit = packumentCache.get(key)
  if (!force && hit && Date.now() - hit.at < UPDATE_TTL_MS) return hit
  const entry = { at: Date.now(), versions: [], latest: null, tags: {}, error: null, absent: false }
  try {
    const res = await fetch(`${REGISTRY}/${key.replace('/', '%2F')}`, {
      headers: { accept: 'application/vnd.npm.install-v1+json, application/json' },
      signal: AbortSignal.timeout(9000),
    })
    if (res.status === 404) {
      entry.absent = true
    } else if (!res.ok) {
      entry.error = `npm registry HTTP ${res.status}`
    } else {
      const doc = await res.json()
      const tags = doc && typeof doc['dist-tags'] === 'object' && doc['dist-tags'] ? doc['dist-tags'] : {}
      entry.tags = tags
      entry.latest = String(tags.latest || '') || null
      const all = doc && typeof doc.versions === 'object' && doc.versions ? Object.keys(doc.versions) : []
      entry.versions = all
        .filter((version) => SEMVER.test(version))
        .sort((a, b) => compareVersions(b, a))
        .slice(0, 40)
        .map((version) => ({
          version,
          tags: Object.keys(tags).filter((tag) => tags[tag] === version),
          prerelease: /-/u.test(version),
        }))
    }
  } catch (error) {
    entry.error = String(error?.message || error)
  }
  packumentCache.set(key, entry)
  return entry
}

async function versionReport(name, force = false) {
  const row = joined().rows.find((item) => item.name === name) || null
  if (!row) return { ok: false, error: { code: 'unknown-plugin', diagnostic: 'profile 里没有这个插件' } }
  const entry = await npmVersions(name, force)
  return {
    ok: !entry.error && !entry.absent,
    name,
    title: row.title || name,
    installed: row.version || '',
    latest: entry.latest,
    tags: entry.tags,
    versions: entry.versions,
    error: entry.error ? { code: 'registry-error', diagnostic: entry.error } : null,
    absent: entry.absent,
  }
}

async function handleVersions(req, res, url, method) {
  const name = String(url?.searchParams?.get('name') || '').trim()
  if (!PACKAGE_NAME.test(name)) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'invalid-target', diagnostic: '缺少或不合法的包名' } }), method)
    return
  }
  const report = await versionReport(name, url?.searchParams?.get('force') === '1')
  sendJson(res, report.error?.code === 'unknown-plugin' ? 404 : 200, JSON.stringify(report), method)
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length)
  let cursor = 0
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      out[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return out
}

/** Compare installed plugins against the npm registry. Read-only, cached for 6h. */
export async function checkUpdates({ force = false } = {}) {
  const { rows, dirs } = joined()
  const targets = rows.filter((row) => !row.missing)
  const items = await mapLimit(targets, 4, async (row) => {
    const dir = dirs.get(row.name) || null
    const item = {
      name: row.name,
      title: row.title || row.name,
      installed: row.version || '',
      latest: null,
      hasUpdate: false,
      source: 'npm',
      note: '',
      spec: row.spec || '',
      specKind: row.specKind || 'registry',
    }
    if (row.name === SELF) {
      item.source = 'local'
      item.spec = row.spec
      item.specKind = row.specKind
      item.note = '本插件自己（装在开发目录里），没有发布源可对比'
      return item
    }
    if (row.specKind === 'git') {
      item.source = 'git'
      item.spec = row.spec
      item.specKind = row.specKind
      item.note = specNote('git')
      return item
    }
    if (row.specKind === 'local' || (dir && isLinkedPackage(dir))) {
      item.source = 'local'
      item.spec = row.spec
      item.specKind = row.specKind || 'local'
      item.note = specNote('local')
      return item
    }
    const entry = await npmLatest(row.name, force)
    if (entry.absent) {
      item.source = 'none'
      item.note = 'npm 上没有这个包（私有或本地安装）'
      return item
    }
    if (entry.error) {
      item.source = 'error'
      item.note = entry.error
      return item
    }
    item.latest = entry.version
    item.hasUpdate = Boolean(entry.version && item.installed && compareVersions(entry.version, item.installed) > 0)
    return item
  })
  const outdated = items.filter((item) => item.hasUpdate)
  return {
    checkedAt: new Date().toISOString(),
    ttlHours: UPDATE_TTL_MS / 3600000,
    registry: REGISTRY,
    total: items.length,
    outdated: outdated.length,
    items,
  }
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const README_CANDIDATES = ['README.zh-CN.md', 'README_ZH.md', 'README.zh.md', 'README.md', 'readme.md']
// READMEs in the wild title their entry-point section very differently, so the
// matcher is a preference ladder: plain usage wording first, then quick-start,
// then gentler "get going" titles. Install/uninstall chapters are excluded even
// when they happen to contain the word 使用.
const USAGE_TIERS = [
  /(用法|使用方式|使用方法|使用说明|使用|怎么用|如何用|usage|how ?to( use)?)/iu,
  /(快速开始|快速上手|快速启动|quick ?start|getting started)/iu,
  /(开始使用|先用起来|上手|入门|起步)/iu,
  // Packages that have no dedicated "usage" section still explain themselves in an
  // overview heading; an excerpt from there beats an empty line.
  /(功能总览|功能|特性|能力|能做什么|介绍|简介|overview|features|what it does)/iu,
]
const USAGE_EXCLUDE = /(安装|卸载|下载|部署|安装与|install|uninstall|配置|config|限制|局限|注意)/iu
const readmeCache = new Map()

function headingOf(line) {
  const m = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/.exec(line)
  if (!m) return null
  return { level: m[1].length, text: m[2].replace(/[`*_]/g, '').trim() }
}

function tidyLine(line) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/^[ \t]*>[ \t]?/u, '')
    .replace(/\*\*/gu, '')
    .replace(/^[ \t]*[-*+][ \t]+/u, '· ')
    .replace(/[ \t]+$/u, '')
    .trim()
}

function clampExcerpt(text) {
  const out = []
  let size = 0
  for (const raw of text.split(/\r?\n/u)) {
    const line = tidyLine(raw)
    if (!line) continue
    if (out.length >= 3 && size + line.length > 420) break
    out.push(line)
    size += line.length + 1
    if (out.length >= 10) break
  }
  return out.join('\n').slice(0, 520)
}

// The usage section a package ships in its README is the only entry-point
// documentation that exists for every plugin, including ones installed after
// this bundle was built.
function readmeUsage(dir) {
  if (readmeCache.has(dir)) return readmeCache.get(dir)
  let found = null
  for (const name of README_CANDIDATES) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(dir, name), 'utf8')
    } catch {
      continue
    }
    const lines = text.split(/\r?\n/u)
    let start = -1
    let level = 0
    for (let tier = 0; tier < USAGE_TIERS.length && start < 0; tier += 1) {
      for (let i = 0; i < lines.length; i += 1) {
        const head = headingOf(lines[i])
        if (!head || USAGE_EXCLUDE.test(head.text)) continue
        if (!USAGE_TIERS[tier].test(head.text)) continue
        start = i + 1
        level = head.level
        break
      }
    }
    if (start < 0) continue
    const body = []
    for (let i = start; i < lines.length; i += 1) {
      const head = headingOf(lines[i])
      if (head && head.level <= level) break
      body.push(lines[i])
    }
    const excerpt = clampExcerpt(body.join('\n'))
    if (!excerpt) continue
    found = { file: name, text: excerpt }
    break
  }
  readmeCache.set(dir, found)
  return found
}

// Bundle-level mount points come from the patch file the package ships; they are
// factual (what this bundle actually inserts) and need no source-code guessing.
function patchMounts(dir, rel) {
  if (typeof rel !== 'string' || !rel) return []
  const file = path.isAbsolute(rel) ? rel : path.join(dir, rel)
  let text = ''
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return []
  }
  const entries = []
  let current = null
  for (const line of text.split(/\r?\n/u)) {
    const m = /^[ \t]*-?[ \t]*(id|name):[ \t]*["']?([^"'\s#]+)/u.exec(line)
    if (!m) continue
    if (m[1] === 'id' || current === null) {
      current = { id: '', name: '' }
      entries.push(current)
    }
    if (m[1] === 'id') current.id = m[2]
    else {
      current.name = m[2]
      current = null
    }
  }
  return entries.filter((entry) => entry.id || entry.name).slice(0, 6)
}

function consider(map, dir) {
  const pkg = readJson(path.join(dir, 'package.json'))
  if (!pkg || !pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) return
  const zh = readJson(path.join(dir, 'locale', 'zh.json'))
  const en = readJson(path.join(dir, 'locale', 'en.json'))
  const meta = zh?.meta || en?.meta || {}
  map.set(pkg.name, {
    name: pkg.name,
    dir,
    version: pkg.version || '',
    title: String(meta.title || '').trim(),
    description: String(meta.description || pkg.description || '').trim(),
    mounts: patchMounts(dir, pkg.dsh.bundle.patch),
    readme: readmeUsage(dir),
    client: Boolean(pkg.dsh.client),
    patch: String(pkg.dsh.bundle.patch || ''),
  })
}

function profileCandidates() {
  const dirs = []
  if (process.env.DSH_PROFILE_DIR) dirs.push(process.env.DSH_PROFILE_DIR)
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  if (process.env.DSH_PROFILE) dirs.push(path.join(home, 'profiles', process.env.DSH_PROFILE))
  const roots = path.join(home, 'profiles')
  let names = []
  try {
    names = fs.readdirSync(roots)
  } catch {
    names = []
  }
  for (const name of names) dirs.push(path.join(roots, name))
  return [...new Set(dirs)]
}

// A profile is identified by declaring this bundle: DSH_PROFILE_DIR is absent
// when the Harness was booted without a profile (for example from the desktop
// app), so fall back to the profile that installed this plugin.
function resolveProfileRoot() {
  for (const dir of profileCandidates()) {
    const pkg = readJson(path.join(dir, 'package.json'))
    const bundles = pkg?.dsh?.profile?.bundles
    if (!Array.isArray(bundles)) continue
    if (!process.env.DSH_PROFILE_DIR && !bundles.includes(SELF)) continue
    return dir
  }
  return null
}

// A plugin installed after this bundle was built has no curated note in catalog.js.
// The panel would then show a description but no entry point at all, which is exactly
// the question a plugin list has to answer. Draft one from what the package itself
// carries - registered commands, registered tools, or its README usage section - and
// label it as drafted so nobody mistakes it for a hand-written note.
const autoCache = new Map()

const MD_NOISE_RE = /^(?:#|!\[|\[!|<|\||```|>|[-*+]\s|\d+[.)]\s|\[[^\]]*\]:)/u

// 只写了英文描述的包：用中文 README 的第一段正文当「作用」，
// 否则面板上会是一句英文，中文用户看不出这个插件干什么。
function readmeZhProse(dir, limit = 110, name = '') {
  if (!dir) return ''
  for (const name of ['README.zh-CN.md', 'README.zh.md', 'README.zh_CN.md', 'README_zh.md']) {
    let text = ''
    try {
      text = fs.readFileSync(path.join(dir, name), 'utf8').slice(0, 20000)
    } catch {
      continue
    }
    for (const raw of text.split(/\r?\n/u)) {
      let line = raw.trim()
      if (!line || MD_NOISE_RE.test(line)) continue
      line = line
        .replace(/!\[[^\]]*\]\([^)]*\)/gu, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
        .replace(/`([^`]*)`/gu, '$1')
        .replace(/\*\*|__/gu, '')
        .replace(/\s+/gu, ' ')
        .trim()
      const cjk = (line.match(/[\u4e00-\u9fff]/gu) || []).length
      if (cjk < 8) continue
      if (name && line.startsWith(name)) {
        line = line.slice(name.length).replace(/^[\s:：\-—]+/u, '').trim()
        if ((line.match(/[\u4e00-\u9fff]/gu) || []).length < 8) continue
      }
      return shortText(line, limit)
    }
  }
  return ''
}

function shortText(value, limit = 110) {
  const text = String(value || '').replace(/\s+/gu, ' ').trim()
  if (text.length <= limit) return text.replace(/[。.]$/u, '')
  const cut = text.slice(0, limit)
  const space = cut.lastIndexOf(' ')
  if (space > limit - 24 && /[A-Za-z]/.test(cut)) return cut.slice(0, space).replace(/[\s,;:]+$/u, '') + '…'
  return cut.replace(/[\s,;:，、；：]+$/u, '') + '…'
}

const DEFINE_TOOL_RE = /defineTool\(\s*\{[^{}]{0,400}?name:\s*['"]([\w.:-]+)['"]/gu

function listLibFiles(dir, depth = 0, out = []) {
  if (depth > 3 || out.length > 60) return out
  let entries = []
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (out.length > 60) break
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      listLibFiles(full, depth + 1, out)
      continue
    }
    if (!/\.(?:c|m)?js$/u.test(entry.name)) continue
    // 工具注册都在 lib/tools/*.js 这类子目录里；客户端 bundle 与 sourcemap 不必读
    if (entry.name.startsWith('client') || entry.name.endsWith('.map')) continue
    try {
      if (fs.statSync(full).size > 400 * 1024) continue
    } catch {
      continue
    }
    out.push(full)
  }
  return out
}

function scanRegistrations(dir) {
  const commands = new Set()
  const tools = new Set()
  const files = dir ? listLibFiles(path.join(dir, 'lib')) : []
  for (const file of files.slice(0, 60)) {
    let text = ''
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const [kind, set] of [['commands', commands], ['tools', tools]]) {
      const rx = new RegExp(kind + String.raw`\.register\(\s*\{[^{}]{0,400}?name:\s*['"]([\w.:-]+)['"]`, 'gu')
      let hit = rx.exec(text)
      while (hit) {
        set.add(hit[1])
        hit = rx.exec(text)
      }
    }
    // Tools declared through `defineTool({ name: SOME_CONSTANT })` only reveal their
    // name in a `const X_TOOL_NAME = 'literal'` line.
    for (const [kind, set] of [['TOOL', tools], ['COMMAND', commands]]) {
      const rx = new RegExp(kind + String.raw`(?:_TOOL|_COMMAND)?_NAME\s*=\s*['"]([\w.:-]+)['"]`, 'gu')
      let hit = rx.exec(text)
      while (hit) {
        set.add(hit[1])
        hit = rx.exec(text)
      }
    }

    // defineTool({ name: 'cad_view' })：名字直接写在 defineTool 里
    let defined = DEFINE_TOOL_RE.exec(text)
    while (defined) {
      tools.add(defined[1])
      defined = DEFINE_TOOL_RE.exec(text)
    }
  }
  return { commands: [...commands].sort(), tools: [...tools].sort() }
}

function draftNote(dir, item) {
  const key = `${item.version}|${dir}`
  if (autoCache.has(key)) return autoCache.get(key)
  const scan = dir ? scanRegistrations(dir) : { commands: [], tools: [] }
  let how = ''
  if (scan.commands.length > 0) {
    how = '斜杠命令：' + scan.commands.slice(0, 4).map((name) => (name.startsWith('/') ? name : '/' + name)).join('、')
  } else if (scan.tools.length > 0) {
    const shown = scan.tools.slice(0, 4).join('、')
    how = '工具：' + shown + (scan.tools.length > 4 ? ` 等 ${scan.tools.length} 个` : '')
  } else if (item.client) {
    // Client-only plugins have no tool and no command: their entry point is the UI.
    const mounts = Array.isArray(item.mounts) ? item.mounts.filter((mount) => /slot|panel|sidebar|main|ui/iu.test(String(mount))) : []
    const bare = String(item.title || '')
      .replace(new RegExp('[\\s]*[(（]\\s*' + String(item.name || '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&') + '\\s*[)）]', 'iu'), '')
      .trim()
    how =
      '界面类插件：装好后在 DSH 界面里找它的入口' +
      (bare && bare !== item.name ? '（' + bare + '）' : '') +
      (mounts.length ? '；它挂载在 ' + mounts.slice(0, 3).join('、') : '') +
      '，没有工具与命令可用'
  } else if (item.readme && item.readme.text) {
    how = shortText(item.readme.text.split(/\r?\n/u)[0], 110)
  } else {
    how = shortText(item.description, 110) || '这个插件没有在包里写用法；点开卡片看 README 节选'
  }
  const drafted = {
    purpose: shortText(readmeZhProse(dir, 110, item.name) || item.description, 110) || '这个插件没有写描述',
    how,
    drafted: true,
  }
  autoCache.set(key, drafted)
  return drafted
}

function discover() {
  const found = new Map()
  const root = resolveProfileRoot()
  if (!root) return found
  const nm = path.join(root, 'node_modules')
  let entries = []
  try {
    entries = fs.readdirSync(nm)
  } catch {
    return found
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    if (entry.startsWith('@')) {
      let inner = []
      try {
        inner = fs.readdirSync(path.join(nm, entry))
      } catch {
        continue
      }
      for (const sub of inner) consider(found, path.join(nm, entry, sub))
    } else {
      consider(found, path.join(nm, entry))
    }
  }
  return found
}

function profileBundles() {
  const root = resolveProfileRoot()
  if (!root) return []
  const pkg = readJson(path.join(root, 'package.json'))
  const bundles = pkg?.dsh?.profile?.bundles
  return Array.isArray(bundles) ? bundles.filter((name) => typeof name === 'string') : []
}

function profileDeps() {
  const root = resolveProfileRoot()
  if (!root) return new Map()
  const pkg = readJson(path.join(root, 'package.json'))
  const deps = pkg?.dependencies
  if (!deps || typeof deps !== 'object') return new Map()
  return new Map(Object.entries(deps).filter((pair) => typeof pair[1] === 'string'))
}

// Where a package came from decides whether an update is even comparable: a registry
// range can be compared against npm, a Git reference is pinned to a commit the panel
// does not compare, and a link:/file: source just mirrors a local directory.
function specKindOf(spec) {
  const value = String(spec || '').trim()
  if (!value) return 'unknown'
  if (/^link:/iu.test(value) || /^file:/iu.test(value) || /^\.\.?[\\/]/u.test(value)) return 'local'
  if (/^(?:github:|git\+|git:|https?:\/\/[^/]+\/[^/]+\/[^/]+)/iu.test(value)) return 'git'
  if (/^[\w.-]+\/[\w.-]+(?:#.*)?$/u.test(value)) return 'git'
  return 'registry'
}

function specNote(kind) {
  if (kind === 'git') return 'git 引用（固定在某个提交）：面板不比较提交，也不会自动更新'
  if (kind === 'local') return '本地包（link: 或符号链接）：内容跟着源目录变，没有可比较的发布版本'
  return ''
}

function joined() {
  const installed = discover()
  const declared = profileBundles()
  const extras = declared.filter((name) => !installed.has(name) && !CURATED[name])
  const dirs = new Map()
  const rows = []
  for (const [name, item] of installed) {
    // Packages that only exist as sub-bundles of a declared plugin (the wallpaper
    // engine ships several) are not user-facing entries; the declared list is the
    // authority for what the profile actually mounts.
    if (declared.length > 0 && !declared.includes(name)) continue
    if (item.dir) dirs.set(name, item.dir)
    const note = CURATED[name]
    const drafted = note ? null : draftNote(item.dir, item)
    rows.push({
      name,
      version: item.version,
      title: (note && note.display) || item.title || name,
      category: (note && note.category) || OTHER,
      purpose: (note && note.purpose) || (drafted && drafted.purpose) || item.description || '',
      how: (note && note.how) || (drafted && drafted.how) || '',
      drafted: Boolean(drafted),
      mounts: item.mounts || [],
      readme: item.readme || null,
      enabled: true,
      curated: Boolean(note),
    })
  }
  // Declared but absent from node_modules: a broken or half-removed install. Report
  // it instead of silently dropping the name.
  for (const name of declared) {
    if (installed.has(name) || name === SELF) continue
    if (name.startsWith('@deepseek-ai/')) continue
    rows.push({
      name,
      version: '',
      title: name,
      category: OTHER,
      purpose: 'profile 声明了这个插件，但 node_modules 里没有它的包',
      how: '重新安装该插件，或在「设置 → 插件」里把它移除',
      mounts: [],
      readme: null,
      enabled: false,
      missing: true,
      curated: false,
    })
  }
  // Curated entries for plugins that the running profile did not reveal: the
  // notes stay useful even when a shell has no DSH_PROFILE_DIR.
  if (rows.length === 0) {
    for (const [name, note] of Object.entries(CURATED)) {
      rows.push({
        name,
        version: '',
        title: note.display || name,
        category: note.category || OTHER,
        purpose: note.purpose || '',
        how: note.how || '',
        mounts: [],
        readme: null,
        enabled: true,
        curated: true,
      })
    }
  }
  // Stamp what only the Host knows: whether a package can be removed at all, whether
  // the installation ships it, and the real activation flag from the profile manifest.
  const deps = profileDeps()
  for (const row of rows) {
    const info = bundlesCache.map.get(row.name)
    row.spec = deps.get(row.name) || ''
    row.specKind = specKindOf(row.spec)
    row.removable = Boolean(info && info.removable)
    row.official = Boolean(info && info.official)
    row.optional = Boolean(info && info.optional)
    row.updateKind = (info && info.update) || null
    row.readOnlyReason = (info && info.readOnlyReason) || null
    // Without the manager service there is nothing to compare against, so keep the
    // previous assumption (declared in the profile = selected) instead of showing 未启用.
    if (info) row.enabled = info.enabled
    if (row.name === SELF) {
      row.removable = false
      row.self = true
    }
  }
  return { rows: attachOverlaps(rows), extras, dirs }
}

// Overlap hints are deliberately a heuristic: plugins that share a significant
// name token (two browsers, two Zotero bridges ...) usually cover the same ground,
// but it is a prompt for the reader, not a claim about behaviour.
const OVERLAP_TOKENS = new Set([
  'browser', 'context', 'memory', 'zotero', 'ppt', 'drawai', 'sidebar', 'market',
  'config', 'fetch', 'search', 'catalog', 'rewind', 'archive', 'skill', 'vision',
  'pet', 'whale', 'wallpaper', 'matlab', 'lunheng', 'compression', 'billion', 'im',
])

function tokensOf(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^@[^/]+\//u, '')
    .split(/[-_.\/]+/u)
    .filter((token) => OVERLAP_TOKENS.has(token))
}

function attachOverlaps(rows) {
  const owners = new Map()
  for (const row of rows) {
    for (const token of tokensOf(row.name)) {
      if (!owners.has(token)) owners.set(token, [])
      owners.get(token).push(row.name)
    }
  }
  for (const row of rows) {
    const near = new Set()
    for (const token of tokensOf(row.name)) {
      for (const name of owners.get(token) || []) if (name !== row.name) near.add(name)
    }
    row.overlaps = [...near]
  }
  return rows
}

function categoryOrder() {
  return [...new Set([...CATEGORIES, OTHER])]
}

function sortRows(rows) {
  return rows.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))
}

function grouped(rows) {
  const order = categoryOrder()
  const buckets = new Map(order.map((c) => [c, []]))
  for (const row of rows) {
    const key = buckets.has(row.category) ? row.category : OTHER
    buckets.get(key).push(row)
  }
  const parts = []
  for (const category of order) {
    const list = sortRows(buckets.get(category))
    if (list.length === 0) continue
    parts.push(`## ${category}（${list.length}）`)
    for (const row of list) parts.push(describe(row))
    parts.push('')
  }
  return parts.join('\n')
}

function describe(row) {
  const version = row.version ? ` v${row.version}` : ''
  const head = `- **${row.title}**（\`${row.name}\`${version}）`
  const purpose = row.purpose ? ` — ${row.purpose}` : ''
  const how = row.how ? ` 用：${row.how}` : ''
  const off = row.missing ? '（声明了但没装上）' : row.enabled === false ? '（未启用）' : ''
  return head + purpose + how + off
}

function detail(row) {
  const lines = [
    `# ${row.title}`,
    '',
    `- 包名：\`${row.name}\``,
    `- 版本：${row.version || '（未读到）'}`,
    `- 分类：${row.category || OTHER}`,
  ]
  if (row.purpose) lines.push(`- 作用：${row.purpose}`)
  if (row.how) lines.push(`- 使用：${row.how}`)
  lines.push(`- 状态：${row.missing ? '声明了但没装上（需重装或移除）' : row.enabled === false ? '未启用' : '已启用'}`)
  if (row.mounts && row.mounts.length > 0) {
    const mounted = row.mounts.map((item) => (item.id === item.name ? item.id : `${item.id}（${item.name}）`))
    lines.push(`- 挂载项：${mounted.join('、')}`)
  }
  if (row.readme && row.readme.text) {
    lines.push('', `摘自 ${row.readme.file} 的用法小节：`, '', row.readme.text)
  }
  if (row.overlaps && row.overlaps.length > 0) {
    lines.push('', `功能可能重叠：${row.overlaps.join('、')}（同类插件，按需二选一即可）。`)
  }
  if (!row.curated) {
    lines.push(
      '- 说明：这个插件还没有精编使用说明，以上描述来自它的插件元数据；可以先读该包的 README 或“设置 → 插件”里的详情页。',
    )
  }
  return lines.join('\n')
}

function search(rows, query) {
  const q = String(query || '').trim().toLowerCase()
  if (!q) return rows
  return rows.filter((row) =>
    [
      row.name,
      row.title,
      row.category,
      row.purpose,
      row.how,
      (row.mounts || []).map((item) => `${item.id} ${item.name}`).join(' '),
      (row.readme && row.readme.text) || '',
    ].some((field) =>
      String(field || '').toLowerCase().includes(q),
    ),
  )
}

function extrasNote(extras) {
  if (extras.length === 0) return ''
  return `\n（官方核心包随 DSH 安装，不在 profile 目录里，未计入：${extras.join('、')}）`
}

/** Same data for the agent tool and the sidebar panel. */
export function buildData(usage) {
  const { rows, extras } = joined()
  applyUsage(rows, usage)
  const order = categoryOrder()
  const counts = {}
  for (const row of rows) counts[row.category] = (counts[row.category] || 0) + 1
  return {
    updatedAt: new Date().toISOString(),
    total: rows.length,
    categories: order.filter((category) => counts[category]).map((category) => ({
      name: category,
      count: counts[category],
    })),
    plugins: sortRows(rows.map((row) => ({ ...row }))),
    extras,
    usage: usage ? usageMeta(usage) : null,
  }
}

async function run(args) {
  const action = String(args?.action || 'list')
  await bundlesInfo(false)
  const { rows, extras } = joined()

  if (action === 'usage') {
    const summary = await usageSummary(Boolean(args?.force))
    const meta = usageMeta(summary)
    const ranked = [...summary.byPackage.entries()]
      .map(([name, acc]) => ({ name, ...acc }))
      .sort((a, b) => b.calls - a.calls)
    const titles = new Map(rows.map((row) => [row.name, row.title]))
    const lines = [
      `插件使用统计：${meta.sessions} 个会话日志里共 ${meta.calls} 次工具调用，其中 ${meta.attributed} 次（${meta.coverage}%）能确定归属到插件。`,
      '',
      '| 插件 | 调用次数 | 占插件调用 | 占全部调用 | 最近一次 |',
      '| --- | ---: | ---: | ---: | --- |',
    ]
    for (const item of ranked) {
      const title = titles.get(item.name) || item.name
      const recent = item.lastAt ? new Date(item.lastAt).toLocaleString('zh-CN', { hour12: false }) : '—'
      lines.push(`| ${title}（\`${item.name}\`） | ${item.calls} | ${share(item.calls, summary.attributed)}% | ${share(item.calls, summary.total)}% | ${recent} |`)
    }
    const silent = rows.filter((row) => !summary.byPackage.has(row.name))
    if (silent.length > 0) lines.push('', `没有调用记录的插件（${silent.length}）：${silent.map((row) => row.name).join('、')}`)
    if (summary.stray.length > 0) {
      const top = summary.stray.slice(0, 8).map((item) => `${item.name} ${item.calls}`).join('、')
      lines.push('', `未归属的调用 ${meta.strayCalls} 次（DSH 内置工具，或还没有登记归属的插件工具）；最多的是：${top}。`)
    }
    lines.push(
      '',
      '口径：只统计会话日志里的 tool/call 事件（不含斜杠命令、也不含只读文档）；归属来自 catalog.js 的 TOOL_OWNERS / TOOL_PREFIXES（人工核过的表，见 tool_owners.json）。日志按 size+mtime 缓存 10 分钟，force=true 可强制重扫；换机或清理会话后数字会变小。',
    )
    return lines.join('\n')
  }

  if (action === 'export') {
      if (args.confirm !== true) {
        return [
          `导出会把当前清单写成一份 ${String(args.format === 'pdf' ? 'PDF（先落 Word 再转）' : 'Word')}：`,
          `- 目标目录：${EXPORT_DIR}`,
          `- 文件名：${EXPORT_NAME}-<时间戳>.${args.format === 'pdf' ? 'pdf' : 'docx'}（选 PDF 时中间的 Word 草稿会删掉）`,
          '- 内容：使用概览、按大类分组的作用/用法/调用次数表、统计口径与未归属调用',
          '- 不改动任何插件与 profile，只是往导出目录写文件',
          '确认导出请再调用一次，带上 confirm: true。',
        ].join('\n')
      }
      const outcome = await exportCatalog({ format: args.format === 'pdf' ? 'pdf' : 'docx' })
      const primary = outcome.pdf || outcome.docx
      const lines = [
        `已导出（${outcome.format === 'pdf' ? 'PDF' : 'Word'}）：${primary.name}（${Math.round(primary.bytes / 1024)} KB）`,
      ]
      if (outcome.pdf && outcome.docx) {
        lines.push(`同时留了一份 Word：${outcome.docx.name}（${Math.round(outcome.docx.bytes / 1024)} KB）`)
      }
      if (outcome.note) lines.push(outcome.note)
      lines.push(`目录：${outcome.dir}`)
      return lines.join('\n')
    }

  if (action === 'updates') {
    const report = await checkUpdates({ force: Boolean(args?.force) })
    const outdated = report.items.filter((item) => item.hasUpdate)
    const local = report.items.filter((item) => item.source === 'local' || item.source === 'none')
    const lines = [
      `插件更新检查：${report.total} 个插件，可更新 ${report.outdated} 个（数据源 ${report.registry}，缓存 ${report.ttlHours} 小时）。`,
      '',
    ]
    if (outdated.length === 0) {
      lines.push('- 没有发现可更新的插件。')
    } else {
      for (const item of outdated) lines.push(`- **${item.title}**（\`${item.name}\`）：v${item.installed} → v${item.latest}`)
    }
    if (local.length > 0) {
      lines.push('', `无发布源、未参与对比（${local.length}）：${local.map((item) => item.name).join('、')}`)
    }
    const broken = report.items.filter((item) => item.source === 'error')
    if (broken.length > 0) {
      lines.push('', `查询失败（${broken.length}）：${broken.map((item) => `${item.name}（${item.note}）`).join('、')}`)
    }
    lines.push(
      '',
      '说明：检查本身只读对比 npm registry，不写磁盘。真要更新，用 action="update" name="包名" version="目标版本" confirm=true（走宿主 pluginManager：先卸载再装精确版本，失败回滚，通常要重启 DSH 才生效）；也可以直接点侧边栏「插件清单」面板里的「更新」按钮。卸载用 action="remove" name="包名" confirm=true（或面板卡片里的「卸载」按钮）。本插件是本地开发包，没有发布源，故不参与自我更新。',
    )
    return lines.join('\n')
  }

  if (action === 'versions') {
    const name = String(args?.name || '').trim()
    if (!name) return 'versions 需要 name（包名），例如 action="versions" name="dsh-ppt"。'
    const report = await versionReport(name, Boolean(args?.force))
    if (report.error) {
      const head = `读不到 ${name} 的版本列表：${report.error.diagnostic}`
      return report.error.code === 'unknown-plugin' ? `${head}\n（profile 里没有这个插件，先 action="list" 看看包名。）` : head
    }
    if (report.absent) return `${name} 在 npm 上没有发布（私有包，或只存在于本地目录）。`
    const lines = [
      `**${report.title}**（\`${name}\`）版本：已装 v${report.installed || '?'}，registry 最新 v${report.latest || '?'}。`,
      '',
      '| 版本 | 标记 |',
      '| --- | --- |',
    ]
    for (const item of report.versions.slice(0, 20)) {
      const marks = []
      if (item.version === report.installed) marks.push('已安装')
      if (item.version === report.latest) marks.push('latest')
      if (item.tags.length > 0) marks.push(item.tags.join('/'))
      if (item.prerelease) marks.push('预发布')
      lines.push(`| ${item.version} | ${marks.join(' · ') || '—'} |`)
    }
    lines.push(
      '',
      '要装某个版本（包括回退到旧版），用 action="update" name="' + name + '" version="目标版本" confirm=true：宿主会先卸载再装这个精确版本，失败回滚，通常要重启 DSH 才生效。',
    )
    return lines.join('\n')
  }

  if (action === 'enable' || action === 'disable') {
    const name = String(args?.name || '').trim()
    const enabling = action === 'enable'
    if (!name) return `${action} 需要 name（包名）。`
    if (args?.confirm !== true) {
      await bundlesInfo(false)
      const row = joined().rows.find((item) => item.name === name)
      if (!row) return `profile 里没有 ${name}。`
      return [
        `将要${enabling ? '启用' : '停用'} **${row.title}**（\`${name}\`）：`,
        enabling ? '- 把它重新选进 profile（写回 profile manifests），重启后挂载。' : '- 把它从 profile 的选择里去掉（写回 profile manifests），重启后不再挂载；包文件不动，随时可以再启用。',
        '- 走宿主 pluginManager.setBundleEnabled，失败会保留原状。',
        '',
        `确认执行：action="${action}" name="${name}" confirm=true`,
      ].join('\n')
    }
    const summary = await performToggle(name, enabling)
    if (!summary.ok) {
      const map = {
        'cannot-toggle-self': '不能在面板里停用插件清单自己：停掉之后面板和工具都进不去。',
        'manager-unavailable': '宿主没有提供 pluginManager.setBundleEnabled。',
        'unknown-plugin': 'profile 里没有这个插件。',
        'busy': '另一个写操作正在进行，稍后再试。',
      }
      return `启用/停用失败（${summary.error?.code}）：${map[summary.error?.code] || summary.error?.diagnostic || ''}`
    }
    if (!summary.changed) return `**${name}** 已经是${summary.enabled ? '启用' : '停用'}状态，没有变化。`
    return [
      `已${summary.enabled ? '启用' : '停用'} **${name}**（application: ${summary.application}）。`,
      summary.restartReason ? '重启 DSH 后生效。' : '已即时生效。',
      ...(summary.warnings.length > 0 ? ['', '提示：' + summary.warnings.join('；')] : []),
    ].join('\n')
  }

  if (action === 'update') {
    const name = String(args?.name || '').trim()
    const version = String(args?.version || '').trim()
    if (args?.confirm !== true) {
      return [
        `更新 ${name || '（未指定插件）'}${version ? ` 到 v${version}` : ''} 是写操作：它会经由宿主的 pluginManager 卸载旧版本、安装新版本，失败时回滚，并通常需要重启 DSH 才生效。`,
        '确认后把 confirm=true 一起传再调用一次（面板里的「更新」按钮就是走这条通道）。',
      ].join('\n')
    }
    if (!PACKAGE_NAME.test(name) || !SEMVER.test(version)) {
      return '参数不完整：name 要精确包名（如 dsh-ppt），version 要目标版本号（如 0.36.0）。'
    }
    await bundlesInfo(true)
    const summary = await performUpdate(name, version)
    const lines = [`更新 ${name}：v${summary.from || '?'} → v${summary.to || version}`]
    if (summary.ok) {
      lines.push(
        summary.application === 'restart-required'
          ? `已装好，但需要重启 DSH 才生效（原因：${summary.restartReason || 'no-hmr'}）。`
          : '已应用，无需重启。',
      )
    } else {
      const code = summary.error?.code || 'unknown'
      lines.push(`失败（${code}${summary.error?.diagnostic ? `：${summary.error.diagnostic}` : ''}）。`)
      if (code === 'incompatible-version') lines.push('目标版本声明的 DSH 版本要求不被当前运行时接受，profile 未被改动。')
      else if (code === 'unknown-plugin') lines.push('这个名字不在当前 profile 的插件声明里，先用 action="list" 确认包名。')
      else if (code === 'manager-unavailable') lines.push('宿主没有暴露 pluginManager 服务，只能到「设置 → 插件」里更新。')
      else if (code === 'busy') lines.push('同一个插件有更新正在进行，稍后再试。')
    }
    if (summary.warnings && summary.warnings.length > 0) {
      lines.push('', `附带警告（${summary.warnings.length}）：${summary.warnings.join('；')}`)
    }
    if (summary.output) lines.push('', '安装输出（末尾）：', '```', summary.output, '```')
    return lines.join('\n')
  }

  if (action === 'remove') {
    const name = String(args?.name || '').trim()
    const row = rows.find((item) => item.name === name)
    const blocked = removalBlocked(row, name)
    const target = row
      ? `**${row.title}**（\`${row.name}\`${row.version ? ` v${row.version}` : ''}）`
      : name || '（未指定插件）'
    if (blocked && blocked.code !== 'unknown-plugin') {
      return `不能卸载 ${target}：${blocked.diagnostic}`
    }
    if (args?.confirm !== true) {
      return [
        `卸载 ${target} 是写操作：宿主会把它从 profile 的依赖与 bundles 声明里移除、删掉它的包文件。` +
          '它注册的工具、命令与面板入口会立刻消失（宿主代码可能要到重启才彻底卸干净），要恢复得重新安装。',
        blocked?.code === 'unknown-plugin' ? '（当前 profile 没有声明这个包，先 action="list" 确认包名。）' : '',
        '确认后把 confirm=true 一起传再调用一次（面板卡片里的「卸载」按钮就是走这条通道）。',
      ]
        .filter(Boolean)
        .join('\n')
    }
    if (!PACKAGE_NAME.test(name)) {
      return '参数不完整：name 要精确包名（如 dsh-ppt）。'
    }
    await bundlesInfo(true)
    const summary = await performRemove(name)
    const lines = [`卸载 ${name}${summary.from ? `（v${summary.from}）` : ''}：`]
    if (summary.ok) {
      lines.push(
        summary.application === 'restart-required'
          ? `已从 profile 移除，但需要重启 DSH 才彻底卸干净（原因：${summary.restartReason || 'no-hmr'}）。`
          : '已从 profile 移除并生效，无需重启。',
      )
      lines.push('它的面板入口、工具与命令现在已消失；要恢复就重新安装（update 动作只升级、不装回）。')
    } else {
      const code = summary.error?.code || 'unknown'
      lines.push(`失败（${code}${summary.error?.diagnostic ? `：${summary.error.diagnostic}` : ''}）。`)
      if (code === 'not-removable') lines.push('宿主判定它不可移除：官方内置包、随装可选包，或这个 profile 不允许管理插件。')
      else if (code === 'cannot-remove-self') lines.push('本插件不能卸载自己——那一刀会连面板和工具一起砍掉。')
      else if (code === 'unknown-plugin') lines.push('这个名字不在当前 profile 的插件声明里，先用 action="list" 确认包名。')
      else if (code === 'manager-unavailable') lines.push('宿主没有暴露 pluginManager 服务，只能到「设置 → 插件」里卸载。')
      else if (code === 'busy') lines.push('同一个插件有写操作正在进行，稍后再试。')
    }
    if (summary.warnings && summary.warnings.length > 0) {
      lines.push('', `附带警告（${summary.warnings.length}）：${summary.warnings.join('；')}`)
    }
    if (summary.output) lines.push('', '安装输出（末尾）：', '```', summary.output, '```')
    return lines.join('\n')
  }

  if (action === 'categories') {
    const counts = new Map()
    for (const row of rows) counts.set(row.category, (counts.get(row.category) || 0) + 1)
    const lines = [`共 ${rows.length} 个已安装插件，分布在 ${counts.size} 个大类：`, '']
    for (const category of categoryOrder()) {
      if (counts.has(category)) lines.push(`- ${category}：${counts.get(category)}`)
    }
    return lines.join('\n') + extrasNote(extras)
  }

  if (action === 'get') {
    const wanted = String(args?.name || args?.query || '').trim()
    const hit =
      rows.find((row) => row.name === wanted) ||
      rows.find((row) => String(row.title).toLowerCase().includes(wanted.toLowerCase()))
    if (!hit) {
      return `没有找到匹配的插件：${wanted || '（未提供名称）'}。先用 action="list" 看全部，或 action="search" 模糊查找。`
    }
    return detail(hit)
  }

  const selected = action === 'search' ? search(rows, args?.query) : rows
  if (selected.length === 0) {
    return `没有匹配的插件${args?.query ? `（关键词：${args.query}）` : ''}。可以换一个关键词，或用 action="list" 看全部。`
  }
  const header =
    action === 'search'
      ? `匹配“${args?.query}”的插件（${selected.length}）：`
      : `当前已安装插件（${selected.length}）的用途与用法：`
  return [
    header,
    '',
    grouped(selected),
    '提示：想只看某一类，用 action="categories"；想查单个插件，用 action="get" name="包名"；想更新或卸载，用 action="updates" 看可更新项，再用 action="update" / action="remove"（写操作都要 confirm=true）。',
  ].join('\n') + extrasNote(extras)
}

function isLocalRequest(req) {
  const address = String(req?.socket?.remoteAddress || '')
  return address === '' || address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('body too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

// Only the fields the panel needs: application / restartReason decide the message,
// error.code decides whether to offer a retry, the log tail goes to the tool result.
function updateSummary(result) {
  // updateBundle nests the ChangeResult under .result; removeBundle returns it flat.
  const core = result?.result && typeof result.result === 'object' ? result.result : result || {}
  const application = String(core.application || '')
  const ok = application === 'applied' || application === 'overridden' || application === 'restart-required'
  return {
    ok,
    changed: Boolean(core.changed),
    application: application || 'unknown',
    restartReason: core.restartReason || null,
    step: result?.step || core.stage || '',
    target: core.target || '',
    error: core.error ? { code: core.error.code || 'operation-error', diagnostic: core.error.diagnostic || '' } : null,
    output: String(result?.packageResult?.output || '').slice(-1200),
  }
}

async function performUpdate(name, version) {
  const { rows } = joined()
  const row = rows.find((item) => item.name === name)
  if (!row) {
    return { ok: false, name, error: { code: 'unknown-plugin', diagnostic: '当前 profile 没有声明这个包' } }
  }
  const pm = managerHolder.pm
  if (!pm || typeof pm.updateBundle !== 'function') {
    return {
      ok: false,
      name,
      error: { code: 'manager-unavailable', diagnostic: '宿主没有暴露 pluginManager 服务（可能不是桌面版，或该服务未加载）' },
    }
  }
  if (WRITE_INFLIGHT.has(name)) {
    return { ok: false, name, error: { code: 'busy', diagnostic: '这个插件正在被更新或卸载，等它结束再点一次' } }
  }
  WRITE_INFLIGHT.add(name)
  const requestId = `catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  try {
    const result = await pm.updateBundle(name, version, { requestId })
    updateCache.delete(name)
    readmeCache.clear()
    await bundlesInfo(true)
    return {
      name,
      from: result?.from || row.version || '',
      to: result?.to || version,
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      ...updateSummary(result),
    }
  } catch (error) {
    return { ok: false, name, error: { code: 'thrown', diagnostic: String(error?.message || error) } }
  } finally {
    WRITE_INFLIGHT.delete(name)
  }
}

// Why the panel refuses to remove this package, or null when the Host says it may go.
// Removing the catalog itself would take away the very panel and tool doing the
// removal, so it is always refused here even if the profile would allow it.
function removalBlocked(row, requested) {
  const name = row?.name || String(requested || '')
  if (name === SELF) {
    return {
      code: 'cannot-remove-self',
      diagnostic: '插件清单不能卸载自己：这一下会连带删掉面板和 plugin_catalog 工具。要卸载它请到「设置 → 插件」里操作。',
    }
  }
  if (name.startsWith('@deepseek-ai/')) {
    return { code: 'not-removable', diagnostic: '官方内置包（@deepseek-ai/…）由安装包随身提供，不能从这里卸载。' }
  }
  const info = bundlesCache.map.get(name)
  if (info && !info.removable) {
    const why = info.optional
      ? '它是随安装包一起提供的可选插件'
      : info.official
        ? '它是官方内置插件'
        : info.readOnlyReason === 'management-required'
          ? '这个 profile 的插件管理权限不允许改动它'
          : info.readOnlyReason === 'unaddressable'
            ? '这里定位不到它的包目录'
            : '宿主判定它不可移除'
    return { code: 'not-removable', diagnostic: why + '，只能开关它，不能卸载。' }
  }
  if (row) return null
  if (info) return { code: 'not-removable', diagnostic: '宿主判定它不可移除，只能开关它。' }
  return { code: 'unknown-plugin', diagnostic: '当前 profile 没有声明这个包' }
}

async function performRemove(name) {
  const { rows } = joined()
  const row = rows.find((item) => item.name === name)
  const blocked = removalBlocked(row, name)
  if (blocked) return { ok: false, name, error: blocked }
  const pm = managerHolder.pm
  if (!pm || typeof pm.removeBundle !== 'function') {
    return {
      ok: false,
      name,
      error: { code: 'manager-unavailable', diagnostic: '宿主没有暴露 pluginManager.removeBundle（可能不是桌面版，或该服务未加载）' },
    }
  }
  if (WRITE_INFLIGHT.has(name)) {
    return { ok: false, name, error: { code: 'busy', diagnostic: '这个插件正在被更新或卸载，等它结束再点一次' } }
  }
  WRITE_INFLIGHT.add(name)
  try {
    const result = await pm.removeBundle(name)
    updateCache.delete(name)
    readmeCache.clear()
    await bundlesInfo(true)
    return {
      name,
      from: row?.version || '',
      warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      ...updateSummary(result),
    }
  } catch (error) {
    return { ok: false, name, error: { code: 'thrown', diagnostic: String(error?.message || error) } }
  } finally {
    WRITE_INFLIGHT.delete(name)
  }
}

async function handleRemove(req, res) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, JSON.stringify({ ok: false, error: { code: 'forbidden', diagnostic: '只接受本机回环地址的卸载请求' } }))
    return
  }
  let payload = null
  try {
    payload = JSON.parse((await readBody(req)) || '{}')
  } catch {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'bad-json', diagnostic: '请求体不是 JSON' } }))
    return
  }
  // Removing a package is irreversible in the panel (no undo button), so it needs the
  // same explicit confirmation an update does.
  if (payload?.confirm !== true) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'confirm-required', diagnostic: '缺少 confirm: true' } }))
    return
  }
  const name = String(payload?.name || '').trim()
  if (!PACKAGE_NAME.test(name)) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'invalid-target', diagnostic: '包名格式不对' } }))
    return
  }
  await bundlesInfo(true)
  const summary = await performRemove(name)
  const status = summary.ok
    ? 200
    : summary.error?.code === 'unknown-plugin'
      ? 404
      : summary.error?.code === 'not-removable' || summary.error?.code === 'cannot-remove-self' || summary.error?.code === 'busy'
        ? 400
        : 500
  sendJson(res, status, JSON.stringify(summary))
}

function toggleSummary(name, enabled, result) {
  const core = result?.result && typeof result.result === 'object' ? result.result : result || {}
  const error = core.error
    ? { code: core.error.code || 'operation-error', diagnostic: core.error.diagnostic || '' }
    : null
  return {
    ok: !error && core.application !== 'failed',
    name,
    enabled: typeof core.enabled === 'boolean' ? core.enabled : Boolean(enabled),
    changed: Boolean(core.changed),
    application: core.application || 'applied',
    restartReason: core.restartReason || null,
    stage: core.stage || 'enable',
    error,
    warnings: Array.isArray(result?.warnings) ? result.warnings : [],
  }
}

async function performToggle(name, enabled) {
  if (name === SELF) {
    return {
      ok: false,
      name,
      enabled: true,
      error: {
        code: 'cannot-toggle-self',
        diagnostic: '不能在面板里停用插件清单自己：停掉之后面板与工具都进不去，也就没法再打开它。请到「设置 → 插件」里操作。',
      },
    }
  }
  const pm = managerHolder.pm
  if (!pm || typeof pm.setBundleEnabled !== 'function') {
    return { ok: false, name, enabled: !enabled, error: { code: 'manager-unavailable', diagnostic: '宿主没有提供 pluginManager.setBundleEnabled' } }
  }
  await bundlesInfo(false)
  const row = joined().rows.find((item) => item.name === name) || null
  const info = bundlesCache.map.get(name) || null
  if (!row && !info) return { ok: false, name, enabled: !enabled, error: { code: 'unknown-plugin', diagnostic: 'profile 里没有这个插件' } }
  if (info && info.enabled === Boolean(enabled)) {
    return { ok: true, name, enabled: Boolean(enabled), changed: false, application: 'applied', restartReason: null, stage: 'enable', error: null, warnings: [] }
  }
  const requestId = `catalog-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  WRITE_INFLIGHT.add(requestId)
  try {
    const result = await pm.setBundleEnabled(name, Boolean(enabled))
    updateCache.delete(name)
    await bundlesInfo(true)
    return toggleSummary(name, enabled, result)
  } catch (error) {
    return {
      ok: false,
      name,
      enabled: !enabled,
      error: { code: 'operation-error', diagnostic: String(error?.message || error) },
    }
  } finally {
    WRITE_INFLIGHT.delete(requestId)
  }
}

async function handleToggle(req, res) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, JSON.stringify({ ok: false, error: { code: 'forbidden', diagnostic: '只接受本机回环地址的启用/停用请求' } }))
    return
  }
  let payload = null
  try {
    payload = JSON.parse((await readBody(req)) || '{}')
  } catch {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'bad-json', diagnostic: '请求体不是 JSON' } }))
    return
  }
  if (payload?.confirm !== true) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'confirm-required', diagnostic: '缺少 confirm: true' } }))
    return
  }
  const name = String(payload?.name || '').trim()
  if (!PACKAGE_NAME.test(name)) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'invalid-target', diagnostic: '包名格式不对' } }))
    return
  }
  if (typeof payload?.enabled !== 'boolean') {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'invalid-target', diagnostic: 'enabled 必须是 true 或 false' } }))
    return
  }
  const summary = await performToggle(name, payload.enabled)
  const status = summary.ok
    ? 200
    : summary.error?.code === 'unknown-plugin'
      ? 404
      : summary.error?.code === 'cannot-toggle-self' || summary.error?.code === 'busy'
        ? 400
        : 500
  sendJson(res, status, JSON.stringify(summary))
}

async function handleUpdate(req, res) {
  if (!isLocalRequest(req)) {
    sendJson(res, 403, JSON.stringify({ ok: false, error: { code: 'forbidden', diagnostic: '只接受本机回环地址的更新请求' } }))
    return
  }
  let payload = null
  try {
    payload = JSON.parse((await readBody(req)) || '{}')
  } catch {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'bad-json', diagnostic: '请求体不是 JSON' } }))
    return
  }
  // A write operation needs an explicit confirmation in the body, so a stray GET/POST
  // from another page cannot install anything by accident.
  if (payload?.confirm !== true) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'confirm-required', diagnostic: '缺少 confirm: true' } }))
    return
  }
  const name = String(payload?.name || '').trim()
  const version = String(payload?.version || '').trim()
  if (!PACKAGE_NAME.test(name) || !SEMVER.test(version)) {
    sendJson(res, 400, JSON.stringify({ ok: false, error: { code: 'invalid-target', diagnostic: '包名或版本号格式不对' } }))
    return
  }
  await bundlesInfo(true)
  const summary = await performUpdate(name, version)
  sendJson(res, summary.ok ? 200 : summary.error?.code === 'unknown-plugin' ? 404 : 500, JSON.stringify(summary))
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/gu, (ch) => {
    if (ch === '&') return '&amp;'
    if (ch === '<') return '&lt;'
    if (ch === '>') return '&gt;'
    if (ch === '"') return '&quot;'
    return '&#39;'
  })
}

/**
 * A standalone page with no dependency on the client slots: if a future DSH release
 * moves or drops `sidebar.panellist`, this URL still renders the catalogue.
 */
function catalogPage(rows, usage) {
  const meta = usageMeta(usage)
  const groups = new Map()
  for (const row of rows) {
    const key = row.category || OTHER
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const order = [...groups.keys()].sort((a, b) => categoryOrder().indexOf(a) - categoryOrder().indexOf(b))
  const body = []
  for (const category of order) {
    const list = groups.get(category).slice().sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh-Hans-CN'))
    body.push(`<h2>${escapeHtml(category)} <span class="dim">${list.length}</span></h2>`)
    body.push('<table><thead><tr><th>插件</th><th>版本</th><th>作用</th><th>使用</th></tr></thead><tbody>')
    for (const row of list) {
      const use = row.usage && row.usage.calls > 0
        ? `${row.usage.calls} 次 · ${row.usage.share}%`
        : '<span class="dim">—</span>'
      body.push(
        '<tr><td><strong>' +
          escapeHtml(row.title || row.name) +
          '</strong><br><code>' +
          escapeHtml(row.name) +
          '</code>' +
          (row.enabled === false ? '<br><span class="off">未启用</span>' : '') +
          '</td><td>' +
          escapeHtml(row.version || '—') +
          '</td><td>' +
          escapeHtml(row.purpose || '') +
          '</td><td class="num">' +
          use +
          '</td></tr>',
      )
    }
    body.push('</tbody></table>')
  }
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>插件清单 · DeepSeek Harness</title>
<style>
body{font:14px/1.6 "Microsoft YaHei","Segoe UI",sans-serif;margin:0;padding:28px 32px;color:#111827;background:#fff}
h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:26px 0 8px}
.dim{color:#667085;font-weight:400}
table{border-collapse:collapse;width:100%;margin:0 0 10px}
th,td{border:1px solid #d0d5dd;padding:7px 10px;text-align:left;vertical-align:top;font-size:13px}
th{background:#f2f4f7;font-weight:600}td.num{white-space:nowrap;text-align:right}
code{font:12px/1.4 Consolas,monospace;color:#475467}
.off{color:#b42318}
.sum{color:#475467;font-size:13px;margin:0 0 18px}
@media print{body{padding:0}table{page-break-inside:auto}tr{page-break-inside:avoid}}
</style></head><body>
<h1>DeepSeek Harness 插件清单</h1>
<p class="sum">${escapeHtml(rows.length)} 个插件 · ${escapeHtml(order.length)} 个大类 · 使用统计：${escapeHtml(meta.calls)} 次调用中 ${escapeHtml(meta.attributed)} 次（${escapeHtml(meta.coverage)}%）可归属 · 数据截至 ${escapeHtml(localTime(meta.at))}</p>
${body.join('\n')}
<p class="sum">这是不依赖侧栏席位的只读页面（<code>${escapeHtml(ROUTE)}/page</code>）；更新、卸载、导出请用侧栏「插件清单」面板。</p>
</body></html>`
}

async function handlePage(req, res, url, method) {
  await bundlesInfo(url?.searchParams?.get('force') === '1')
  const usage = await usageSummary(false)
  const { rows } = joined()
  applyUsage(rows, usage)
  const html = catalogPage(rows, usage)
  res.statusCode = 200
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(method === 'HEAD' ? '' : html)
}

/** `/plugin-catalog [包名 | updates | 大类名]` — a text surface for hosts without slots. */
async function commandReply(rawArguments) {
  const argument = String(rawArguments || '').trim()
  await bundlesInfo(false)
  const { rows } = joined()
  if (/^updates?$/iu.test(argument)) {
    const report = await checkUpdates({ force: false })
    const outdated = report.items.filter((item) => item.hasUpdate)
    if (outdated.length === 0) return `已安装 ${report.total} 个插件，对比 ${REGISTRY} 后没有发现可更新版本（结果缓存 ${report.ttlHours} 小时）。`
    return [
      `可更新的插件（${outdated.length}/${report.total}）：`,
      ...outdated.map((item) => `· ${item.title}（${item.name}）：${item.installed} → ${item.latest}`),
      '',
      '在侧栏「插件清单」面板里点「更新」，或让模型调用 plugin_catalog 的 action="update"。',
    ].join('\n')
  }
  const byName = rows.find((row) => row.name.toLowerCase() === argument.toLowerCase())
  if (byName) {
    const usage = await usageSummary(false)
    applyUsage([byName], usage)
    const use = byName.usage && byName.usage.calls > 0 ? `${byName.usage.calls} 次 · 占插件调用 ${byName.usage.share}%` : '暂无调用记录'
    const mounts = (byName.mounts || []).map((mount) => mount.id || mount.name).join('、') || '—'
    return [
      `${byName.title}（${byName.name}） v${byName.version || '?'} · ${byName.category}`,
      `作用：${byName.purpose || '—'}`,
      `怎么用：${byName.how || '—'}`,
      `挂载：${mounts}`,
      `使用：${use}`,
    ].join('\n')
  }
  const inCategory = rows.filter((row) => row.category === argument)
  if (argument && inCategory.length > 0) {
    return [
      `${argument}（${inCategory.length}）：`,
      ...inCategory.map((row) => `· ${row.title}（${row.name}） v${row.version || '?'}`),
    ].join('\n')
  }
  const usage = await usageSummary(false)
  const meta = usageMeta(usage)
  const categories = new Map()
  for (const row of rows) categories.set(row.category, (categories.get(row.category) || 0) + 1)
  const top = [...usage.byPackage.entries()]
    .map(([name, acc]) => ({ name, calls: acc.calls }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 3)
    .map((item) => `${item.name} ${item.calls} 次`)
  return [
    `已安装 ${rows.length} 个插件：${[...categories.entries()].map(([name, count]) => `${name} ${count}`).join(' · ')}`,
    `使用统计：${meta.calls} 次工具调用，${meta.attributed} 次（${meta.coverage}%）可归属；最多的是 ${top.join('、') || '—'}`,
    '',
    '用法：/plugin-catalog <包名> 看单个插件的用法；/plugin-catalog updates 看可更新版本；/plugin-catalog <大类名> 看一类。',
  ].join('\n')
}

function registerCatalogCommand(ctx) {
  const mount = (scope) => {
    const commands = scope?.commands ?? scope?.get?.('commands')
    if (!commands || typeof commands.register !== 'function') return undefined
    const pending = commands.register({
      name: 'plugin-catalog',
      description: '列出已安装插件的清单、用法与使用统计：/plugin-catalog [包名 | updates | 大类名]',
      handler: async (invocation) => {
        try {
          return { kind: 'success', text: await commandReply(invocation?.rawInput) }
        } catch (error) {
          return { kind: 'error', text: `plugin-catalog 出错：${String(error?.message || error)}` }
        }
      },
    })
    if (pending && typeof pending.then === 'function') {
      pending.catch(() => {})
      return undefined
    }
    return () => {
      try {
        if (typeof pending === 'function') pending()
      } catch {
        // already released
      }
    }
  }
  try {
    const direct = mount(ctx)
    if (direct) {
      ctx.effect(direct, 'plugin-catalog: /plugin-catalog command')
      return
    }
  } catch {
    // fall through to the waiting form below
  }
  try {
    ctx.inject(['commands'], (scope) => mount(scope))
  } catch {
    // host without the commands service: the panel and the tool still work
  }
}

function sendJson(res, status, body, method) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(method === 'HEAD' ? '' : body)
}

async function serve(req, res) {
  try {
    const method = req.method === 'HEAD' ? 'HEAD' : req.method
    let url = null
    try {
      url = new URL(req.url || '/', 'http://localhost')
    } catch {
      url = null
    }
    const pathname = String(url?.pathname || ROUTE).replace(/\/+$/u, '')
    if (pathname === `${ROUTE}/update` || pathname === `${ROUTE}/remove`) {
      const removing = pathname === `${ROUTE}/remove`
      if (method !== 'POST') {
        sendJson(res, 405, JSON.stringify({
          ok: false,
          error: { code: 'method-not-allowed', diagnostic: removing ? '卸载只接受 POST' : '更新只接受 POST' },
        }))
        return
      }
      if (removing) await handleRemove(req, res)
      else await handleUpdate(req, res)
      return
    }
    if (pathname === `${ROUTE}/export` || pathname === `${ROUTE}/export/download`) {
      const downloading = pathname === `${ROUTE}/export/download`
      if (downloading) {
        if (method !== 'GET' && method !== 'HEAD') {
          res.statusCode = 405
          res.setHeader('content-type', 'text/plain; charset=utf-8')
          res.end('method not allowed')
          return
        }
        handleExportDownload(req, res, url)
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, JSON.stringify({
          ok: false,
          error: { code: 'method-not-allowed', diagnostic: '导出只接受 POST' },
        }))
        return
      }
      await handleExport(req, res)
      return
    }
    if (pathname === `${ROUTE}/toggle`) {
      if (method !== 'POST') {
        sendJson(res, 405, JSON.stringify({
          ok: false,
          error: { code: 'method-not-allowed', diagnostic: '启用/停用只接受 POST' },
        }))
        return
      }
      await handleToggle(req, res)
      return
    }
    if (method !== 'GET' && method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('content-type', 'text/plain; charset=utf-8')
      res.end('method not allowed')
      return
    }
    if (pathname === `${ROUTE}/usage.json`) {
      const summary = await usageSummary(url?.searchParams?.get('force') === '1')
      sendJson(res, 200, JSON.stringify(usagePayload(summary)), method)
      return
    }
    if (pathname === `${ROUTE}/updates.json`) {
      const report = await checkUpdates({ force: url?.searchParams?.get('force') === '1' })
      sendJson(res, 200, JSON.stringify(report), method)
      return
    }
    if (pathname === `${ROUTE}/versions.json`) {
      await handleVersions(req, res, url, method)
      return
    }
    if (pathname === `${ROUTE}/page`) {
      await handlePage(req, res, url, method)
      return
    }
    if (pathname === ROUTE || pathname === '') {
      await bundlesInfo(url?.searchParams?.get('force') === '1')
      const usage = await usageSummary(url?.searchParams?.get('force') === '1')
      sendJson(res, 200, JSON.stringify(buildData(usage)), method)
      return
    }
    sendJson(res, 404, JSON.stringify({ error: 'not found' }), method)
  } catch (error) {
    sendJson(res, 500, JSON.stringify({ error: String(error?.message || error) }), req.method)
  }
}

function mountRoute(ctx) {
  const register = (scope) => {
    const ws = scope?.webServer ?? scope?.get?.('webServer') ?? ctx.webServer
    if (!ws || typeof ws.register !== 'function') return null
    const dispose = ws.register({ kind: 'prefix', path: ROUTE, handler: (req, res) => serve(req, res) })
    return () => {
      try {
        dispose()
      } catch {
        // already released
      }
    }
  }
  try {
    const direct = register(ctx)
    if (direct) {
      ctx.effect(direct, 'plugin-catalog: catalog route')
      return
    }
  } catch {
    // fall through to the waiting form below
  }
  try {
    ctx.inject(['webServer'], (scope) => {
      const dispose = register(scope)
      return dispose ?? undefined
    })
  } catch {
    // headless host without a web carrier: the tool still works
  }
}

export function apply(ctx) {
  capturePluginManager(ctx)

  ctx.effect(() => {
    const dispose = ctx.tools.register({
      name: 'plugin_catalog',
      description:
        'Explain what an installed DSH plugin does and how to use it. Reads the running profile (DSH_PROFILE_DIR) to discover the bundles it declares, merges curated usage notes with each package metadata, and returns grouped Markdown; each entry also carries the bundle mount points parsed from its cordis.patch.yml and a usage excerpt lifted from its README. action="usage" counts tool calls in the local DSH session logs ($DSH_HOME/sessions), attributes them to plugins through a hand-checked tool table, and reports the call count of each plugin plus its share of plugin calls (read-only, 10min cache). action="updates" compares the installed plugins against the npm registry (read-only, 6h cache) and reports which ones have a newer published version. action="update" performs a real update through the Host plugin manager (pluginManager.updateBundle: removes, installs the exact version, restores the old one on failure, and usually needs a DSH restart) — it is a write operation and refuses to run without confirm=true. action="remove" uninstalls one plugin through pluginManager.removeBundle (it rewrites the profile manifest and deletes the package files; the panel refuses to remove itself or an official/optional bundle) — also a write operation that needs confirm=true. action="export" writes the whole catalogue out as a real .docx (and converts it to PDF with the LibreOffice shipped inside DSH when available) into the export folder, with the same layout as the hand-made Word manual — also a write operation that needs confirm=true. Use it when the user asks "这个插件是干什么的 / 怎么用 / 有没有能处理 X 的插件 / 哪些插件该更新了 / 帮我更新 X / 把某个插件退回旧版本 / 先把它停用".',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'categories', 'search', 'get', 'usage', 'updates', 'update', 'remove', 'export', 'versions', 'enable', 'disable'],
            description:
              'list: all plugins grouped by category; categories: counts only; search: filter by query; get: one plugin detail; usage: how often the tools of each plugin were actually called in the local session logs (read-only); updates: check installed versions against the npm registry; update: install a newer version of one plugin (write operation, needs confirm=true); remove: uninstall one plugin (write operation, needs confirm=true); export: write the whole catalogue out as a Word file (or PDF) into the export folder (write operation, needs confirm=true). versions: every published version of one plugin, newest first, with the installed one marked (read-only; this is how you plan a rollback). enable / disable: select or deselect one plugin in the profile through pluginManager.setBundleEnabled, so it stops mounting after a restart (write operation, needs confirm=true; the panel refuses to disable itself).',
          },
          query: { type: 'string', description: 'search keyword, or the name/title fragment for get.' },
          name: { type: 'string', description: 'Exact package name for action="get" / action="update" / action="remove" / action="versions" / action="enable" / action="disable".' },
          version: { type: 'string', description: 'Target version for action="update", e.g. 0.36.0.' },
          confirm: { type: 'boolean', description: 'action="update" / action="remove" / action="enable" / action="disable": must be true, otherwise the call only explains what it would do.' },
          force: { type: 'boolean', description: 'usage: rescan the session logs now; updates: ignore the 6h cache and query the registry again.' },
          format: { type: 'string', enum: ['docx', 'pdf'], description: 'action="export": docx (default) or pdf.' },
        },
        additionalProperties: false,
      },
      output: STRING_OUTPUT,
      execute: async (args) => run(args),
    })
    return () => {
      try {
        dispose()
      } catch {
        // best effort: the registry may already have released the tool
      }
    }
  }, 'plugin-catalog: plugin_catalog tool')

  mountRoute(ctx)
  registerCatalogCommand(ctx)
}
