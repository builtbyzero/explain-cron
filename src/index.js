// cron-plain — explain cron expressions in plain English.
// Public API:
//   explain(expression, options)       → result object
//   formatResult(result, options)      → polished text block (optionally colored)
//   formatJson(result, options)        → JSON string for --json mode

import cronParser from 'cron-parser';
import cronstrue from 'cronstrue';
import { makeColors } from './format.js';

const ALIASES = new Set([
  '@yearly',
  '@annually',
  '@monthly',
  '@weekly',
  '@daily',
  '@midnight',
  '@hourly',
]);

function assertSupported(expr) {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error('cron expression is empty');
  if (trimmed.startsWith('@')) {
    if (!ALIASES.has(trimmed.toLowerCase())) {
      throw new Error(`Unsupported alias "${trimmed}". Try one of: ${[...ALIASES].join(', ')}`);
    }
    return;
  }
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(
      `cron-plain v0.1 supports standard 5-field cron (minute hour day-of-month month day-of-week). ` +
        `Got ${fields.length} fields: "${trimmed}". ` +
        `6-field (AWS EventBridge) and other dialects are coming in the Pro tier — see builtbyzero.com.`
    );
  }
}

/**
 * Explain a cron expression in plain English and compute the next N run times.
 * @param {string} expression
 * @param {{count?: number, tz?: string, currentDate?: Date}} [options]
 */
export function explain(expression, options = {}) {
  if (typeof expression !== 'string') {
    throw new TypeError('expression must be a string');
  }
  const { count = 10, tz, currentDate } = options;
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new RangeError('count must be an integer between 1 and 100');
  }
  assertSupported(expression);

  let description;
  try {
    description = cronstrue.toString(expression, { use24HourTimeFormat: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not explain "${expression}": ${msg}`);
  }

  let interval;
  try {
    interval = cronParser.parseExpression(expression, {
      tz,
      currentDate: currentDate ?? new Date(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not parse "${expression}": ${msg}`);
  }

  const nextRuns = [];
  for (let i = 0; i < count; i++) {
    nextRuns.push(interval.next().toDate());
  }

  return { expression: expression.trim(), description, nextRuns };
}

/**
 * Format a result as a human-readable block of text with optional ANSI color.
 * Layout: labeled "Expression:" / "Meaning:" / "Next N run times" lines,
 * indented run entries, dim index gutter, blank line separators.
 *
 * @param {{expression:string, description:string, nextRuns:Date[]}} result
 * @param {{tz?:string, color?:boolean}} [options]
 */
export function formatResult(result, options = {}) {
  const { tz } = options;
  const c = makeColors(options);

  const fmt = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: tz,
    timeZoneName: 'short',
  });

  // Labels are kept ("Expression:", "Meaning:", "Next N run times") so that
  // existing scripts grepping the output keep working.
  const label = (s) => c.boldCyan(s);
  const lines = [];
  lines.push(`${label('Expression:')} ${c.bold(result.expression)}`);
  lines.push(`${label('Meaning:   ')} ${c.bold(result.description)}`);
  lines.push('');
  const tzLabel = tz ? `(${tz})` : '(local time)';
  lines.push(`${label(`Next ${result.nextRuns.length} run times`)} ${c.dim(tzLabel)}`);
  for (const [i, d] of result.nextRuns.entries()) {
    const idx = c.dim(String(i + 1).padStart(2, ' ') + '.');
    lines.push(`  ${idx} ${fmt.format(d)}`);
  }
  return lines.join('\n');
}

/** JSON-stringifiable view of a result; ISO-format dates. */
export function toJsonResult(result, options = {}) {
  return {
    expression: result.expression,
    meaning: result.description,
    timezone: options.tz ?? null,
    next_runs: result.nextRuns.map((d) => d.toISOString()),
  };
}

/** Serialize a result to JSON text. */
export function formatJson(result, options = {}) {
  return JSON.stringify(toJsonResult(result, options), null, 2);
}
