// explain-cron — explain cron expressions in plain English.
// Public API: explain(expression, options), formatResult(result, options).
//
// v0.1 supports standard 5-field cron (minute hour day-of-month month day-of-week)
// and a handful of @-aliases that cron-parser understands (@hourly, @daily, ...).
//
// Pro-tier syntaxes (AWS EventBridge 6-field, GitHub Actions quirks,
// Kubernetes CronJob caveats) are not yet implemented — see --pro in cli.js.

import cronParser from 'cron-parser';
import cronstrue from 'cronstrue';

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
      `explain-cron v0.1 supports standard 5-field cron (minute hour day-of-month month day-of-week). ` +
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

/** Format a result as a human-readable block of text. */
export function formatResult(result, options = {}) {
  const { tz } = options;
  const lines = [];
  lines.push(`Expression: ${result.expression}`);
  lines.push(`Meaning:    ${result.description}`);
  lines.push('');
  lines.push(`Next ${result.nextRuns.length} run times${tz ? ` (${tz})` : ' (local time)'}:`);
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
  for (const [i, d] of result.nextRuns.entries()) {
    lines.push(`  ${String(i + 1).padStart(2, ' ')}. ${fmt.format(d)}`);
  }
  return lines.join('\n');
}
