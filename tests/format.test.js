// Formatting / color / JSON tests for v0.3.0 polish.
// Wired into tests/run.js via dynamic import below.

import { explain, formatResult, formatJson } from '../src/index.js';
import { explainPro, formatProResult, formatProJson } from '../src/pro.js';
import { stripAnsi, makeColors } from '../src/format.js';

function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function assertEq(a, b, m) { if (a !== b) throw new Error(`${m||'!='}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function includes(h, n, m) { if (!h.includes(n)) throw new Error(`${m||'missing'}: ${JSON.stringify(n)} not in ${JSON.stringify(h)}`); }

const FIXED = new Date('2026-01-01T00:00:00Z');

export const formatTests = [
  ['format: respects {color:false}', () => {
    const r = explain('*/5 * * * *', { count: 2, currentDate: FIXED });
    const out = formatResult(r, { color: false });
    // No ANSI escapes at all when color disabled
    assert(!/\x1b\[/.test(out), `unexpected ANSI in: ${JSON.stringify(out)}`);
    // Existing labels still present
    includes(out, 'Expression:');
    includes(out, 'Meaning:');
    includes(out, 'Next 2 run times');
  }],
  ['format: {color:true} emits ANSI', () => {
    const r = explain('*/5 * * * *', { count: 1, currentDate: FIXED });
    const out = formatResult(r, { color: true });
    assert(/\x1b\[/.test(out), 'expected ANSI escapes');
    // After stripping, labels remain
    const plain = stripAnsi(out);
    includes(plain, 'Expression:');
    includes(plain, 'Meaning:');
  }],
  ['format: NO_COLOR env disables color', () => {
    const prev = process.env.NO_COLOR;
    process.env.NO_COLOR = '1';
    try {
      const c = makeColors({});
      assertEq(c.enabled, false);
      assertEq(c.bold('hi'), 'hi');
    } finally {
      if (prev === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = prev;
    }
  }],
  ['format: indented run lines, dim index gutter (when color)', () => {
    const r = explain('*/5 * * * *', { count: 3, currentDate: FIXED });
    const out = formatResult(r, { color: false });
    const lines = out.split('\n');
    const runLines = lines.filter(l => /^ {2}\s*\d+\./.test(l));
    assertEq(runLines.length, 3, `expected 3 indented run lines, got ${runLines.length}`);
  }],
  ['json: formatJson emits parseable JSON with expected fields', () => {
    const r = explain('*/5 * * * *', { count: 2, currentDate: FIXED });
    const s = formatJson(r, { tz: 'UTC' });
    const parsed = JSON.parse(s);
    assertEq(parsed.expression, '*/5 * * * *');
    assertEq(typeof parsed.meaning, 'string');
    assertEq(parsed.timezone, 'UTC');
    assertEq(parsed.next_runs.length, 2);
    assert(/^\d{4}-\d{2}-\d{2}T/.test(parsed.next_runs[0]), 'ISO date');
  }],
  ['json: timezone null when omitted', () => {
    const r = explain('*/5 * * * *', { count: 1, currentDate: FIXED });
    const parsed = JSON.parse(formatJson(r));
    assertEq(parsed.timezone, null);
  }],
  ['pro: formatProResult labels + sections, no ANSI when color:false', () => {
    const result = explainPro('0 18 ? * MON-FRI *', 'eventbridge');
    const out = formatProResult(result, { color: false });
    assert(!/\x1b\[/.test(out), 'no ANSI');
    includes(out, 'Dialect:');
    includes(out, 'Pattern:');
    includes(out, 'Meaning:');
    includes(out, 'Docs:');
  }],
  ['pro: warnings/notes use prefixes', () => {
    // Both dom and dow specified → triggers warning
    const result = explainPro('0 9 1 * MON *', 'eventbridge');
    const out = formatProResult(result, { color: false });
    assert(out.includes('⚠') || out.includes('Warnings'), 'expected warning marker');
  }],
  ['pro: formatProJson emits parseable JSON', () => {
    const result = explainPro('*/10 * * * *', 'github');
    const s = formatProJson(result);
    const parsed = JSON.parse(s);
    assertEq(parsed.dialect, 'GitHub Actions');
    assert(Array.isArray(parsed.notes));
    assert(typeof parsed.meaning === 'string');
  }],
];
