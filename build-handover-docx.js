/**
 * build-handover-docx.js
 *
 * Generates HANDOVER.docx from HANDOVER.md with Benifex branding.
 * Run with: node build-handover-docx.js
 *
 * Branding:
 *   primary: #7637E3 (Benifex purple)  → headings, accent rules
 *   accent:  #BD65FF (lilac)           → table header background
 *   success: #00BD00 (green)           → "good practice" callouts (rare)
 *   text:    #180126                   → body text
 *
 * Strategy: hand-rolled markdown block parser → docx-js elements. Lightweight,
 * no extra deps, predictable output. Inline parsing handles bold/italic/code.
 */

const fs = require('fs');
const path = require('path');
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, PageOrientation, LevelFormat,
    HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber,
    PageBreak, TableOfContents, TabStopType, TabStopPosition
} = require('docx');

// ─────────────────────────────────────────────────────────────────────
// Brand constants
// ─────────────────────────────────────────────────────────────────────
const BRAND = {
    purple: '7637E3',
    purpleLight: 'EFE3FB',
    lilac: 'BD65FF',
    lilacLight: 'F5E6FF',
    green: '00BD00',
    dark: '180126',
    grey: '64748B',
    codeBg: 'F4F1F8',
    rowAlt: 'FAF7FD',
    border: 'CCCCCC'
};
const BODY_FONT = 'Inter';     // falls back to system sans on Win
const CODE_FONT = 'Menlo';     // monospace, falls back to Consolas
const PAGE_W = 12240;          // US Letter DXA
const PAGE_H = 15840;
const MARGIN = 1440;
const CONTENT_W = PAGE_W - 2 * MARGIN; // 9360 DXA

// ─────────────────────────────────────────────────────────────────────
// Markdown block parser
// ─────────────────────────────────────────────────────────────────────
const MD_PATH = path.join(__dirname, 'HANDOVER.md');
const md = fs.readFileSync(MD_PATH, 'utf8');

/**
 * Parse markdown into an array of block tokens:
 *   { type: 'heading', level, text }
 *   { type: 'paragraph', text }
 *   { type: 'code', lang, text }
 *   { type: 'ul', items: [text] }
 *   { type: 'ol', items: [text] }
 *   { type: 'table', headers: [text], rows: [[text]] }
 *   { type: 'hr' }
 *   { type: 'blank' }
 */
function parse(md) {
    const lines = md.split(/\r?\n/);
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Code block (```)
        if (/^```/.test(line)) {
            const lang = line.replace(/^```/, '').trim();
            const buf = [];
            i++;
            while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
            i++; // closing ```
            blocks.push({ type: 'code', lang, text: buf.join('\n') });
            continue;
        }

        // Heading (# ... ######)
        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() });
            i++;
            continue;
        }

        // Horizontal rule
        if (/^---\s*$/.test(line)) {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        // Table — header row, separator, body rows
        if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s|:-]+\|$/.test(lines[i + 1])) {
            const headers = parseRow(line);
            i += 2; // skip header + separator
            const rows = [];
            while (i < lines.length && /^\|.*\|/.test(lines[i])) {
                rows.push(parseRow(lines[i]));
                i++;
            }
            blocks.push({ type: 'table', headers, rows });
            continue;
        }

        // Unordered list (- or *)
        if (/^\s*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                // Continuation lines (indented, no list marker) get appended to last item
                let item = lines[i].replace(/^\s*[-*]\s+/, '');
                i++;
                while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
                    item += ' ' + lines[i].trim();
                    i++;
                }
                items.push(item);
            }
            blocks.push({ type: 'ul', items });
            continue;
        }

        // Ordered list (1. 2. ...)
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                let item = lines[i].replace(/^\s*\d+\.\s+/, '');
                i++;
                while (i < lines.length && /^\s{3,}\S/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
                    item += ' ' + lines[i].trim();
                    i++;
                }
                items.push(item);
            }
            blocks.push({ type: 'ol', items });
            continue;
        }

        // Blank line
        if (line.trim() === '') {
            blocks.push({ type: 'blank' });
            i++;
            continue;
        }

        // Default: paragraph (consume continuation lines)
        const buf = [line];
        i++;
        while (i < lines.length && lines[i].trim() !== '' &&
               !/^(#|```|---\s*$|\||\s*[-*]\s+|\s*\d+\.\s+)/.test(lines[i])) {
            buf.push(lines[i]);
            i++;
        }
        blocks.push({ type: 'paragraph', text: buf.join(' ') });
    }
    return blocks;
}

function parseRow(line) {
    return line
        .replace(/^\|/, '').replace(/\|$/, '')
        .split('|').map(c => c.trim());
}

// ─────────────────────────────────────────────────────────────────────
// Inline formatting → array of TextRun
// Handles **bold**, *italic*, `inline code`, and plain text
// ─────────────────────────────────────────────────────────────────────
function inlineRuns(text, baseProps = {}) {
    const runs = [];
    // Tokenise: split on ` ` boundary first, then within plain segments handle ** and *
    const tokens = [];
    let buf = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] === '`') {
            if (buf) { tokens.push({ kind: 'plain', text: buf }); buf = ''; }
            const end = text.indexOf('`', i + 1);
            if (end === -1) { buf += text[i]; i++; continue; }
            tokens.push({ kind: 'code', text: text.slice(i + 1, end) });
            i = end + 1;
        } else {
            buf += text[i];
            i++;
        }
    }
    if (buf) tokens.push({ kind: 'plain', text: buf });

    for (const tok of tokens) {
        if (tok.kind === 'code') {
            runs.push(new TextRun({
                ...baseProps,
                text: tok.text,
                font: CODE_FONT,
                size: 20, // 10pt — slightly smaller than body
                shading: { fill: BRAND.codeBg, type: ShadingType.CLEAR }
            }));
        } else {
            // Plain — handle **bold** and *italic*
            let s = tok.text;
            const subRuns = [];
            const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
            let last = 0, m;
            while ((m = re.exec(s)) !== null) {
                if (m.index > last) subRuns.push({ text: s.slice(last, m.index) });
                if (m[2] !== undefined) subRuns.push({ text: m[2], bold: true });
                else if (m[3] !== undefined) subRuns.push({ text: m[3], italics: true });
                last = re.lastIndex;
            }
            if (last < s.length) subRuns.push({ text: s.slice(last) });
            for (const r of subRuns) {
                runs.push(new TextRun({ ...baseProps, font: BODY_FONT, ...r }));
            }
        }
    }
    return runs;
}

// ─────────────────────────────────────────────────────────────────────
// Render block tokens → docx children
// ─────────────────────────────────────────────────────────────────────
function renderBlocks(blocks) {
    const children = [];
    for (const b of blocks) {
        if (b.type === 'heading') {
            // Markdown H1 (#) is the doc title — render as H1 (largest).
            // Markdown H2 (##) is a major section — H1 in docx for TOC visibility.
            // Markdown H3 (###) → H2 in docx.
            // Markdown H4 (####) → H3 in docx.
            let docLevel;
            let size;
            if (b.level === 1) { docLevel = HeadingLevel.HEADING_1; size = 44; }
            else if (b.level === 2) { docLevel = HeadingLevel.HEADING_1; size = 36; }
            else if (b.level === 3) { docLevel = HeadingLevel.HEADING_2; size = 28; }
            else { docLevel = HeadingLevel.HEADING_3; size = 24; }
            children.push(new Paragraph({
                heading: docLevel,
                spacing: { before: 360, after: 180 },
                children: [new TextRun({
                    text: b.text,
                    bold: true,
                    size,
                    color: BRAND.purple,
                    font: BODY_FONT
                })]
            }));
        } else if (b.type === 'paragraph') {
            children.push(new Paragraph({
                spacing: { before: 80, after: 80, line: 320 },
                children: inlineRuns(b.text, { color: BRAND.dark, size: 22 })
            }));
        } else if (b.type === 'code') {
            // Render each code line as its own paragraph with grey shading + monospace
            const codeLines = b.text.split('\n');
            for (const cl of codeLines) {
                children.push(new Paragraph({
                    spacing: { before: 0, after: 0 },
                    shading: { fill: BRAND.codeBg, type: ShadingType.CLEAR },
                    children: [new TextRun({
                        text: cl || ' ',
                        font: CODE_FONT,
                        size: 20,
                        color: BRAND.dark
                    })]
                }));
            }
            // Trailing blank line so the next paragraph isn't kissing the code block
            children.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: '' })] }));
        } else if (b.type === 'ul') {
            for (const item of b.items) {
                children.push(new Paragraph({
                    numbering: { reference: 'bullets', level: 0 },
                    spacing: { before: 40, after: 40 },
                    children: inlineRuns(item, { color: BRAND.dark, size: 22 })
                }));
            }
        } else if (b.type === 'ol') {
            for (const item of b.items) {
                children.push(new Paragraph({
                    numbering: { reference: 'numbers', level: 0 },
                    spacing: { before: 40, after: 40 },
                    children: inlineRuns(item, { color: BRAND.dark, size: 22 })
                }));
            }
        } else if (b.type === 'table') {
            children.push(buildTable(b));
            // Spacer
            children.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: '' })] }));
        } else if (b.type === 'hr') {
            // Horizontal rule = empty paragraph with bottom border
            children.push(new Paragraph({
                spacing: { before: 120, after: 120 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND.purple, space: 1 } },
                children: [new TextRun({ text: '' })]
            }));
        } else if (b.type === 'blank') {
            // skip — heading/paragraph spacing handles vertical rhythm
        }
    }
    return children;
}

function buildTable(b) {
    const colCount = b.headers.length;
    // Distribute width evenly — could be smarter but works for our content.
    const colWidth = Math.floor(CONTENT_W / colCount);
    const columnWidths = Array(colCount).fill(colWidth);
    // Last column absorbs the rounding remainder
    columnWidths[colCount - 1] = CONTENT_W - colWidth * (colCount - 1);

    const border = { style: BorderStyle.SINGLE, size: 4, color: BRAND.border };
    const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

    const headerRow = new TableRow({
        tableHeader: true,
        children: b.headers.map((h, idx) => new TableCell({
            borders,
            width: { size: columnWidths[idx], type: WidthType.DXA },
            shading: { fill: BRAND.lilac, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: [new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [new TextRun({
                    text: stripInline(h),
                    bold: true,
                    color: 'FFFFFF',
                    size: 22,
                    font: BODY_FONT
                })]
            })]
        }))
    });

    const bodyRows = b.rows.map((row, rIdx) => new TableRow({
        children: row.map((cell, cIdx) => new TableCell({
            borders,
            width: { size: columnWidths[cIdx], type: WidthType.DXA },
            shading: rIdx % 2 === 1 ? { fill: BRAND.rowAlt, type: ShadingType.CLEAR } : undefined,
            margins: { top: 80, bottom: 80, left: 140, right: 140 },
            children: [new Paragraph({
                spacing: { before: 0, after: 0 },
                children: inlineRuns(cell, { color: BRAND.dark, size: 20 })
            })]
        }))
    }));

    return new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths,
        rows: [headerRow, ...bodyRows]
    });
}

function stripInline(text) {
    return text.replace(/\*\*/g, '').replace(/`/g, '');
}

// ─────────────────────────────────────────────────────────────────────
// Cover page + TOC
// ─────────────────────────────────────────────────────────────────────
function coverPage() {
    return [
        new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: '' })] }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
            children: [new TextRun({ text: 'Capacity Model v2', bold: true, size: 96, color: BRAND.purple, font: BODY_FONT })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 300 },
            children: [new TextRun({ text: 'Maintenance & Handover Guide', size: 40, color: BRAND.dark, font: BODY_FONT, italics: true })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 600 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: BRAND.purple, space: 1 } },
            children: [new TextRun({ text: '' })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 80 },
            children: [new TextRun({ text: 'Maintainer: Addy', size: 26, color: BRAND.dark, font: BODY_FONT })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 80 },
            children: [new TextRun({ text: '2026-04-28', size: 24, color: BRAND.grey, font: BODY_FONT })]
        }),
        new Paragraph({ children: [new PageBreak()] })
    ];
}

function tocPage() {
    return [
        new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 240 },
            children: [new TextRun({ text: 'Contents', bold: true, size: 40, color: BRAND.purple, font: BODY_FONT })]
        }),
        new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ children: [new PageBreak()] })
    ];
}

// ─────────────────────────────────────────────────────────────────────
// Build document
// ─────────────────────────────────────────────────────────────────────
const blocks = parse(md);

// Strip the raw H1 from md (we render our own cover) and the auto-generated TOC list
// from the markdown — we'll let Word generate the real one.
let firstH1Stripped = false;
let tocStripStart = -1, tocStripEnd = -1;
const filtered = [];
for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!firstH1Stripped && b.type === 'heading' && b.level === 1) {
        firstH1Stripped = true;
        continue;
    }
    // Skip the markdown's own "Table of Contents" heading + its following ordered list,
    // because Word generates the TOC from headings and we don't want a duplicate.
    if (b.type === 'heading' && /^Table of Contents$/i.test(b.text)) {
        tocStripStart = i;
        // Skip until the next heading
        let j = i + 1;
        while (j < blocks.length && blocks[j].type !== 'heading') j++;
        tocStripEnd = j - 1;
        i = j - 1;
        continue;
    }
    filtered.push(b);
}

const body = renderBlocks(filtered);

const doc = new Document({
    creator: 'Capacity Model v2 maintenance script',
    title: 'Capacity Model v2 — Maintenance & Handover Guide',
    styles: {
        default: { document: { run: { font: BODY_FONT, size: 22, color: BRAND.dark } } },
        paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 36, bold: true, color: BRAND.purple, font: BODY_FONT },
              paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 28, bold: true, color: BRAND.purple, font: BODY_FONT },
              paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 } },
            { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { size: 24, bold: true, color: BRAND.purple, font: BODY_FONT },
              paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 } }
        ]
    },
    numbering: {
        config: [
            { reference: 'bullets',
              levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
            { reference: 'numbers',
              levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
                style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
        ]
    },
    sections: [{
        properties: {
            page: {
                size: { width: PAGE_W, height: PAGE_H },
                margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }
            }
        },
        headers: {
            default: new Header({
                children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({
                        text: 'Capacity Model v2 — Handover',
                        size: 18,
                        color: BRAND.grey,
                        font: BODY_FONT,
                        italics: true
                    })]
                })]
            })
        },
        footers: {
            default: new Footer({
                children: [new Paragraph({
                    tabStops: [{ type: TabStopType.RIGHT, position: PAGE_W - 2 * MARGIN }],
                    children: [
                        new TextRun({ text: 'Benifex — Confidential', size: 18, color: BRAND.grey, font: BODY_FONT }),
                        new TextRun({ text: '\tPage ', size: 18, color: BRAND.grey, font: BODY_FONT }),
                        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: BRAND.grey, font: BODY_FONT }),
                        new TextRun({ text: ' of ', size: 18, color: BRAND.grey, font: BODY_FONT }),
                        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: BRAND.grey, font: BODY_FONT })
                    ]
                })]
            })
        },
        children: [...coverPage(), ...tocPage(), ...body]
    }]
});

// ─────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────
const OUT_PATH = path.join(__dirname, 'HANDOVER.docx');
Packer.toBuffer(doc).then(buf => {
    fs.writeFileSync(OUT_PATH, buf);
    console.log(`Wrote ${OUT_PATH} (${buf.length.toLocaleString()} bytes)`);
}).catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
