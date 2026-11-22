// Minimal, dependency-free .docx writer.
//
// The export must work on any machine that installs this plugin, so it cannot
// rely on python-docx or LibreOffice being present. Everything here is OOXML
// plus a hand-rolled ZIP container (Node only gives us raw deflate, not a zip
// writer), which is enough for a text-and-tables report that Word opens
// natively and LibreOffice can convert to PDF.

import zlib from 'node:zlib'

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const A4 = { w: 11906, h: 16838 }
const MARGIN = { top: 1440, right: 1134, bottom: 1440, left: 1134 }
const CONTENT_WIDTH = A4.w - MARGIN.left - MARGIN.right // 9638 twips ≈ 17.0cm

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[i] = value
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

/** Build a ZIP archive from [{name, data:Buffer}] with deflate and CRC32. */
export function zipArchive(entries) {
  const chunks = []
  const central = []
  let offset = 0

  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data), 'utf8')
    const deflated = zlib.deflateRawSync(raw, { level: 9 })
    const useDeflate = deflated.length < raw.length
    const body = useDeflate ? deflated : raw
    const crc = crc32(raw)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 names
    local.writeUInt16LE(useDeflate ? 8 : 0, 8)
    local.writeUInt16LE(dosTime, 10)
    local.writeUInt16LE(dosDate, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(body.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    chunks.push(local, name, body)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(20, 4)
    dir.writeUInt16LE(20, 6)
    dir.writeUInt16LE(0x0800, 8)
    dir.writeUInt16LE(useDeflate ? 8 : 0, 10)
    dir.writeUInt16LE(dosTime, 12)
    dir.writeUInt16LE(dosDate, 14)
    dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(body.length, 20)
    dir.writeUInt32LE(raw.length, 24)
    dir.writeUInt16LE(name.length, 28)
    dir.writeUInt16LE(0, 30)
    dir.writeUInt16LE(0, 32)
    dir.writeUInt16LE(0, 34)
    dir.writeUInt16LE(0, 36)
    dir.writeUInt32LE(0, 38)
    dir.writeUInt32LE(offset, 42)
    central.push(dir, name)

    offset += local.length + name.length + body.length
  }

  const centralStart = offset
  const centralSize = central.reduce((total, part) => total + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(centralStart, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, ...central, end])
}

const esc = (value) =>
  String(value == null ? '' : value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    // Control characters are illegal in XML and crash Word.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, ' ')

const FONT_BODY = 'Microsoft YaHei'
const FONT_LATIN = 'Segoe UI'

function run(text, style = {}) {
  const parts = [`<w:r><w:rPr>`]
  parts.push(`<w:rFonts w:ascii="${FONT_LATIN}" w:hAnsi="${FONT_LATIN}" w:eastAsia="${FONT_BODY}"/>`)
  if (style.bold) parts.push('<w:b/>')
  if (style.italic) parts.push('<w:i/>')
  if (style.size) parts.push(`<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>`)
  if (style.color) parts.push(`<w:color w:val="${style.color}"/>`)
  parts.push('</w:rPr>')
  parts.push(`<w:t xml:space="preserve">${esc(text)}</w:t>`)
  parts.push('</w:r>')
  return parts.join('')
}

function paragraph(content, options = {}) {
  const props = []
  if (options.style) props.push(`<w:pStyle w:val="${options.style}"/>`)
  if (options.align) props.push(`<w:jc w:val="${options.align}"/>`)
  if (options.indent) props.push(`<w:ind w:left="${options.indent}"/>`)
  const before = options.spaceBefore == null ? 0 : options.spaceBefore
  const after = options.spaceAfter == null ? 80 : options.spaceAfter
  props.push(`<w:spacing w:before="${before}" w:after="${after}" w:line="${options.line || 264}" w:lineRule="auto"/>`)
  if (options.keepNext) props.push('<w:keepNext/>')
  const runs = Array.isArray(content) ? content.join('') : String(content || '')
  return `<w:p><w:pPr>${props.join('')}</w:pPr>${runs}</w:p>`
}

function cell(width, content, options = {}) {
  const props = [`<w:tcW w:type="dxa" w:w="${width}"/>`]
  if (options.fill) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>`)
  props.push('<w:vAlign w:val="top"/>')
  const body = Array.isArray(content) ? content : [content]
  return `<w:tc><w:tcPr>${props.join('')}</w:tcPr>${body.join('')}</w:tc>`
}

function table(columns, header, rows) {
  const widths = columns.map((column) => column.width)
  const total = widths.reduce((sum, value) => sum + value, 0)
  if (total > CONTENT_WIDTH + 1) throw new Error(`table too wide: ${total} > ${CONTENT_WIDTH}`)

  const parts = ['<w:tbl><w:tblPr>']
  parts.push(`<w:tblW w:type="dxa" w:w="${total}"/>`)
  parts.push('<w:tblLayout w:type="fixed"/>')
  parts.push('<w:tblBorders>')
  for (const edge of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) {
    parts.push(`<w:${edge} w:val="single" w:sz="4" w:space="0" w:color="D0D5DD"/>`)
  }
  parts.push('</w:tblBorders>')
  parts.push('<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="96" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="96" w:type="dxa"/></w:tblCellMar>')
  parts.push('</w:tblPr><w:tblGrid>')
  for (const width of widths) parts.push(`<w:gridCol w:w="${width}"/>`)
  parts.push('</w:tblGrid>')

  if (header) {
    parts.push('<w:tr><w:trPr><w:tblHeader/></w:trPr>')
    header.forEach((label, index) => {
      parts.push(
        cell(widths[index], [paragraph(run(label, { bold: true, size: 18 }), { spaceAfter: 0 })], { fill: 'F2F4F7' }),
      )
    })
    parts.push('</w:tr>')
  }

  for (const row of rows) {
    parts.push('<w:tr>')
    row.forEach((value, index) => {
      // A cell is either one line of text, or a list of lines. A line is either
      // a plain string or { runs: [[text, style], ...] } for mixed sizes/colors.
      const lines = Array.isArray(value) ? value : [value]
      const rendered = lines.map((line) => {
        if (typeof line === 'string') return paragraph(run(line, { size: 18 }), { spaceAfter: 0 })
        const runs = (line && Array.isArray(line.runs) ? line.runs : [[String(line && line.text), {}]])
          .map(([text, style]) => run(text, Object.assign({ size: 18 }, style || {})))
          .join('')
        return paragraph(runs, { spaceAfter: line && line.spaceAfter != null ? line.spaceAfter : 0 })
      })
      parts.push(cell(widths[index], rendered))
    })
    parts.push('</w:tr>')
  }

  parts.push('</w:tbl>')
  // Word needs a paragraph after a table, otherwise successive tables merge.
  parts.push(paragraph('', { spaceAfter: 120, size: 8 }))
  return parts.join('')
}

const STYLES = `${XML_HEAD}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT_LATIN}" w:hAnsi="${FONT_LATIN}" w:eastAsia="${FONT_BODY}" w:cs="${FONT_LATIN}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>
<w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
<w:rPr><w:b/><w:sz w:val="30"/><w:szCs w:val="30"/><w:color w:val="1D2939"/></w:rPr></w:style>
</w:styles>`

const CONTENT_TYPES = `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

const ROOT_RELS = `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const DOC_RELS = `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`

const FOOTER = `${XML_HEAD}<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:t xml:space="preserve">第 </w:t></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="667085"/></w:rPr><w:t xml:space="preserve"> 页</w:t></w:r>
</w:p></w:ftr>`

function coreProps(title, author) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z')
  return `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><cp:lastModifiedBy>${esc(author)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

const APP_PROPS = `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>dsh-plugin-catalog</Application></Properties>`

/**
 * Render a document model into a .docx buffer.
 * model.blocks: [{type:'title'|'subtitle'|'heading'|'para'|'note'|'table'|'pagebreak', ...}]
 */
export function buildDocx(model = {}) {
  const blocks = Array.isArray(model.blocks) ? model.blocks : []
  const body = []

  for (const block of blocks) {
    if (block.type === 'title') {
      body.push(paragraph(run(block.text, { bold: true, size: 44, color: '101828' }), { spaceBefore: 480, spaceAfter: 160, line: 360 }))
    } else if (block.type === 'subtitle') {
      body.push(paragraph(run(block.text, { size: 20, color: '667085' }), { spaceAfter: 120 }))
    } else if (block.type === 'heading') {
      body.push(paragraph(run(block.text, { bold: true, size: 30, color: '1D2939' }), { style: 'Heading1', spaceBefore: 320, spaceAfter: 120, keepNext: true }))
    } else if (block.type === 'para') {
      body.push(paragraph(run(block.text, { size: block.size || 21 }), { spaceAfter: block.spaceAfter == null ? 100 : block.spaceAfter }))
    } else if (block.type === 'note') {
      body.push(paragraph(run(block.text, { size: 17, color: '667085' }), { spaceAfter: 160 }))
    } else if (block.type === 'bullet') {
      body.push(paragraph([run('· ', { size: 21 }), run(block.text, { size: 21 })], { indent: 200, spaceAfter: 60 }))
    } else if (block.type === 'table') {
      body.push(table(block.columns, block.header, block.rows))
    } else if (block.type === 'pagebreak') {
      body.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    }
  }

  const sect = `<w:sectPr><w:footerReference w:type="default" r:id="rId2"/><w:pgSz w:w="${A4.w}" w:h="${A4.h}"/><w:pgMar w:top="${MARGIN.top}" w:right="${MARGIN.right}" w:bottom="${MARGIN.bottom}" w:left="${MARGIN.left}" w:header="851" w:footer="992" w:gutter="0"/></w:sectPr>`
  const document = `${XML_HEAD}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}${sect}</w:body></w:document>`

  return zipArchive([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: coreProps(model.title || 'Plugin catalog', model.author || 'dsh-plugin-catalog') },
    { name: 'docProps/app.xml', data: APP_PROPS },
    { name: 'word/document.xml', data: document },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
    { name: 'word/footer1.xml', data: FOOTER },
    { name: 'word/styles.xml', data: STYLES },
  ])
}

export { CONTENT_WIDTH }
