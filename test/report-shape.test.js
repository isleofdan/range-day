'use strict';
// Every line Dan is to type goes in a fenced block, alone, so it has a copy button (Dan, 17 Nov 2026: "Fenced block, motherfucker.
// That is a rule: always make copy and paste easy for me."; again 21 Nov 2026 on range-day-twelve: "Fenced block with copy button").
// The closing message a session sends Dan is built from its field report ("Closing message to Dan", and the Asks it draws on), so
// this check reads those two sections of every report: a sentence that tells Dan to type, send, reply or paste something and
// carries it as inline code (`…`) or quotes, instead of a fenced block under it, fails. Taste constraint azxfbwouwp9lt6jhny8n.
//   node --test test/report-shape.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'docs', 'reports');
// Reports written before this check existed: records, left as they were (nothing stored before is rewritten).
const BEFORE = new Set(['range-day-one', 'range-day-two', 'range-day-three', 'range-day-four', 'range-day-five', 'range-day-six', 'range-day-seven', 'range-day-eight', 'range-day-nine', 'range-day-ten', 'range-day-eleven']);
// A verb asking Dan to produce words, followed on the same line by those words as inline code or in quotes.
const ASK = /\b(type|typed|send|reply|answer|paste|say|write)\b[^`"\n]*[`"]/i;

// The sections Dan reads: from "## Asks" or "## Closing message to Dan" to the next "## " heading.
function sections(text) {
  const out = [];
  const re = /^## (Asks|Closing message to Dan)\s*$/gm;
  let m;
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + m[0].length);
    const end = rest.search(/^## /m);
    out.push({ name: m[1], body: end < 0 ? rest : rest.slice(0, end) });
  }
  return out;
}

// Lines outside fenced blocks that ask Dan to type something and carry it inline.
function inlineTypedLines(body) {
  const bad = [];
  let fenced = false, asked = false; // asked: the line before asked for words and ended there ("If yes, type:")
  for (const line of body.split('\n')) {
    if (/^\s*```/.test(line)) { fenced = !fenced; asked = false; continue; }
    if (fenced) continue;
    if (asked && /^\s*[`"]/.test(line)) { bad.push(line.trim()); asked = false; continue; }
    asked = /\b(type|typed|send|reply|answer|paste|say|write)\b[^`"\n]*:\s*$/i.test(line);
    // inline code or a quote, closed on the line or running on to the next (a wrapped line)
    if (ASK.test(line) && /`[^`]{3,}(`|$)|"[^"]{8,}("|$)/.test(line)) bad.push(line.trim());
  }
  return bad;
}

test('every report\'s Asks and closing message carry a line for Dan to type in its own fenced block, never inline', () => {
  const reports = fs.readdirSync(DIR).filter((f) => f.endsWith('-report.md'));
  const found = [];
  for (const f of reports) {
    const name = f.replace(/-report\.md$/, '');
    if (BEFORE.has(name)) continue;
    for (const s of sections(fs.readFileSync(path.join(DIR, f), 'utf8'))) for (const line of inlineTypedLines(s.body)) found.push(`${f}, ${s.name}: ${line}`);
  }
  assert.deepEqual(found, [], `a line for Dan to type is inline; put it alone in a fenced block under the sentence:\n  ${found.join('\n  ')}`);
});

test('the check refuses the shapes that reached Dan, and passes the fenced one', () => {
  const refused = [
    '1. Merge and deploy? If yes, type: `yes, merge and deploy range-day-twelve, then merge its notes`',
    'Type exactly: `yes, merge and deploy range-day-one, then merge its notes`',
    '   Recommended: yes. Type `yes, merge and deploy range-day-twelve, then',
    'Now type this line here: "yes, merge tense-third-person"',
  ];
  for (const l of refused) assert.deepEqual(inlineTypedLines(l), [l.trim()], l);
  // the ask on one line, the words inline on the next (range-day-twelve's closing message, 21 Nov 2026)
  assert.deepEqual(inlineTypedLines('1. Merge and deploy anyway? If yes, type:\n   `yes, merge and deploy range-day-twelve, then merge its notes`'), ['`yes, merge and deploy range-day-twelve, then merge its notes`']);
  const fencedOk = ['1. Merge and deploy? If yes, type this line:', '```', 'yes, merge and deploy range-day-twelve, then merge its notes', '```'].join('\n');
  assert.deepEqual(inlineTypedLines(fencedOk), []);
  assert.deepEqual(inlineTypedLines('The change is pull request #36. Every check passed.'), []);
});
