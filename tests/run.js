// Minimal zero-dep test runner. Run with `node tests/run.js`.
import { explain, formatResult } from '../src/index.js';
import { main } from '../src/cli.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

function assertThrows(fn, pattern, msg) {
  try {
    fn();
  } catch (err) {
    if (pattern && !pattern.test(err.message)) {
      throw new Error(`${msg || 'wrong error'}: got "${err.message}"`);
    }
    return;
  }
  throw new Error(`${msg || 'expected to throw'} but did not`);
}
async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

console.log('explain()');
test('every-5-minutes', () => {
  const r = explain('*/5 * * * *', { currentDate: new Date('2026-01-01T00:00:00Z') });
  assert(/every 5 minutes/i.test(r.description), `got: ${r.description}`);
  assertEqual(r.nextRuns.length, 10, 'default count is 10');
});

test('weekdays-at-9am', () => {
  const r = explain('0 9 * * 1-5', {
    count: 3,
    currentDate: new Date('2026-01-01T00:00:00Z'),
  });
  assert(/9:00 AM/i.test(r.description) || /at 9:00/i.test(r.description), `got: ${r.description}`);
  assertEqual(r.nextRuns.length, 3);
});

test('alias-@daily', () => {
  const r = explain('@daily', { count: 2, currentDate: new Date('2026-01-01T00:00:00Z') });
  assert(/at 12:00 AM|midnight|every day/i.test(r.description), `got: ${r.description}`);
});

test('respects-tz', () => {
  const r = explain('0 12 * * *', {
    count: 1,
    tz: 'America/Denver',
    currentDate: new Date('2026-06-15T00:00:00Z'),
  });
  assertEqual(r.nextRuns.length, 1);
  assert(r.nextRuns[0] instanceof Date);
});

test('rejects-6-field', () => {
  assertThrows(() => explain('0 */5 * * * *'), /5-field/i);
});

test('rejects-empty', () => {
  assertThrows(() => explain(''), /empty/i);
});

test('rejects-non-string', () => {
  assertThrows(() => explain(123), /string/i);
});

test('rejects-bad-count', () => {
  assertThrows(() => explain('* * * * *', { count: 0 }), /count/i);
  assertThrows(() => explain('* * * * *', { count: 1000 }), /count/i);
});

console.log('\nformatResult()');
test('format-includes-expression-and-meaning', () => {
  const r = explain('*/5 * * * *', {
    count: 2,
    currentDate: new Date('2026-01-01T00:00:00Z'),
  });
  const s = formatResult(r);
  assert(s.includes('Expression: */5 * * * *'), 'missing expression line');
  assert(s.includes('Meaning:'), 'missing meaning line');
  assert(s.includes('Next 2 run times'), 'missing next-runs header');
});

(async () => {
console.log('\ncli main()');

async function captureStdout(fn) {
  const orig = process.stdout.write.bind(process.stdout);
  const errOrig = process.stderr.write.bind(process.stderr);
  let out = '';
  let err = '';
  process.stdout.write = (chunk) => {
    out += chunk;
    return true;
  };
  process.stderr.write = (chunk) => {
    err += chunk;
    return true;
  };
  let code;
  try {
    code = await fn();
  } finally {
    process.stdout.write = orig;
    process.stderr.write = errOrig;
  }
  return { code, out, err };
}

await asyncTest('cli-help', async () => {
  const { code, out } = await captureStdout(() => main(['--help']));
  assertEqual(code, 0);
  assert(out.includes('Usage:'), 'help should include usage');
});

await asyncTest('cli-version', async () => {
  const { code, out } = await captureStdout(() => main(['--version']));
  assertEqual(code, 0);
  assert(/0\.2\.0/.test(out), 'should print version');
});

await asyncTest('cli-dialect-eventbridge', async () => {
  const { code, out } = await captureStdout(() => main(['0 18 ? * MON-FRI *', '--dialect', 'eventbridge']));
  assertEqual(code, 0);
  assert(out.includes('EventBridge'), 'should say EventBridge');
  assert(out.includes('Docs:'), 'should include docs link');
});

await asyncTest('cli-missing-expression', async () => {
  const { code, err } = await captureStdout(() => main([]));
  assertEqual(code, 2);
  assert(/missing cron expression/.test(err));
});

await asyncTest('cli-runs-expression', async () => {
  const { code, out } = await captureStdout(() => main(['*/5 * * * *', '--count', '3']));
  assertEqual(code, 0);
  assert(out.includes('Expression: */5 * * * *'));
  assert(out.includes('Next 3 run times'));
});

await asyncTest('cli-rejects-bad-count', async () => {
  const { code, err } = await captureStdout(() => main(['*/5 * * * *', '--count', '999']));
  assertEqual(code, 2);
  assert(/count/i.test(err));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
})();