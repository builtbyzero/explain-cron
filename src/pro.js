// cron-plain Pro — dialect explainers for EventBridge, GitHub Actions, k8s CronJob
// Loaded only when --license is passed and validated.

import cronParser from 'cron-parser';
import cronstrue from 'cronstrue';

// ─── AWS EventBridge ──────────────────────────────────────────────────────────
// 6 fields: minute hour day-of-month month day-of-week year
// Special: L (last), W (nearest weekday), # (nth weekday), ? (no specific value)
// year range: 1970–2199

const EB_MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const EB_DAYS   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function parseEventBridge(expr) {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 6) {
    throw new Error(`AWS EventBridge cron expressions have exactly 6 fields (got ${fields.length}). Format: minute hour day-of-month month day-of-week year`);
  }
  const [minute, hour, dom, month, dow, year] = fields;
  const warnings = [];
  const notes = [];

  // EventBridge requires exactly one of dom/dow to be ?
  if (dom !== '?' && dow !== '?') {
    warnings.push('Both day-of-month and day-of-week are specified. AWS EventBridge requires one of them to be "?" (no specific value). This expression may be rejected.');
  }
  if (dom === '?' && dow === '?') {
    warnings.push('Both day-of-month and day-of-week are "?". At least one must specify a value.');
  }

  // Detect L and W
  if (dom.includes('L')) notes.push('L in day-of-month means "last day of the month".');
  if (dom.includes('W')) notes.push('W in day-of-month means "nearest weekday to that day".');
  if (dow.includes('L')) notes.push('L in day-of-week means "last [weekday] of the month" (e.g. 6L = last Saturday).');
  if (dow.includes('#')) notes.push('# in day-of-week means "nth occurrence" (e.g. 2#1 = first Monday).');

  // Try to get a human-readable description by converting to 5-field for cronstrue
  let meaning = '';
  try {
    const fiveField = `${minute} ${hour} ${dom === '?' ? '*' : dom} ${month} ${dow === '?' ? '*' : dow}`;
    meaning = cronstrue.toString(fiveField, { use24HourTimeFormat: false });
  } catch (e) {
    meaning = '(complex schedule — see notes below)';
  }

  // Year field interpretation
  let yearNote = '';
  if (year === '*') yearNote = 'every year';
  else if (year.includes('-')) yearNote = `years ${year}`;
  else if (year.includes('/')) yearNote = `every ${year.split('/')[1]} year(s) starting ${year.split('/')[0]}`;
  else if (year.includes(',')) yearNote = `years ${year}`;
  else yearNote = `year ${year}`;

  return {
    dialect: 'AWS EventBridge',
    expression: expr,
    fields: { minute, hour, dom, month, dow, year },
    meaning: meaning + (yearNote !== 'every year' ? `, ${yearNote}` : ''),
    warnings,
    notes,
    docs: 'https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html',
  };
}

// ─── GitHub Actions ───────────────────────────────────────────────────────────

function analyzeGitHubActions(expr) {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`GitHub Actions uses standard 5-field cron. Got ${fields.length} fields.`);
  }
  const [minute, hour, dom, month, dow] = fields;
  const warnings = [];
  const notes = [];

  notes.push('GitHub Actions cron schedules always run in UTC.');

  // 5-minute minimum
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.slice(2), 10);
    if (interval < 5) {
      warnings.push(`Interval */m where m < 5 (you have */${interval}) is not supported — GitHub enforces a minimum 5-minute interval.`);
    }
  }
  if (minute === '*') {
    warnings.push('minute="*" means every minute — GitHub will throttle this to at most once per 5 minutes and may disable the workflow entirely.');
  }

  // Inactivity note
  notes.push('Workflows in repos with no activity for 60 days are automatically disabled by GitHub. Push a commit or trigger manually to re-enable.');

  // Nested schedule trigger note
  notes.push('The schedule trigger fires based on when GitHub\'s scheduler runs, which can be delayed by up to 15–30 min during high load.');

  // Detect @yearly/@monthly aliases
  if (expr.trim().startsWith('@')) {
    notes.push(`GitHub Actions does not support @ aliases like ${expr.trim()} in the schedule field. Use the equivalent 5-field expression.`);
  }

  let meaning = '';
  try {
    meaning = cronstrue.toString(expr, { use24HourTimeFormat: false });
    meaning += ' (UTC)';
  } catch (e) {
    meaning = '(parse error — double-check the expression)';
  }

  return {
    dialect: 'GitHub Actions',
    expression: expr,
    fields: { minute, hour, dom, month, dow },
    meaning,
    warnings,
    notes,
    docs: 'https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule',
  };
}

// ─── Kubernetes CronJob ───────────────────────────────────────────────────────

function analyzeKubernetes(expr) {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Kubernetes CronJob uses standard 5-field cron. Got ${fields.length} fields.`);
  }
  const [minute, hour, dom, month, dow] = fields;
  const warnings = [];
  const notes = [];

  notes.push('Kubernetes CronJob schedules run in the timezone of the kube-controller-manager process (usually UTC unless configured otherwise).');
  notes.push('CRON_TZ and TZ spec prefixes (e.g. CRON_TZ=America/Denver 0 9 * * *) are supported in Kubernetes 1.24+ with the CronJobTimeZone feature gate enabled.');

  // Concurrency policy reminder
  notes.push('Default concurrencyPolicy is Allow — if a job run is still in progress when the next trigger fires, a second pod will start. Set concurrencyPolicy: Forbid or Replace if that\'s not what you want.');

  // Missed schedule note
  notes.push('If the CronJob controller is down for more than its startingDeadlineSeconds window, missed runs will be skipped (not queued).');

  let meaning = '';
  try {
    meaning = cronstrue.toString(expr, { use24HourTimeFormat: false });
  } catch (e) {
    meaning = '(parse error — double-check the expression)';
  }

  return {
    dialect: 'Kubernetes CronJob',
    expression: expr,
    fields: { minute, hour, dom, month, dow },
    meaning,
    warnings,
    notes,
    docs: 'https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/',
  };
}

// ─── Auto-detect dialect ──────────────────────────────────────────────────────

export function detectDialect(expr) {
  const fields = expr.trim().split(/\s+/);
  // 6 fields → likely EventBridge
  if (fields.length === 6) return 'eventbridge';
  // 5 fields is ambiguous; need --dialect flag to distinguish GH Actions vs k8s
  return 'standard';
}

export function explainPro(expr, dialect) {
  switch (dialect) {
    case 'eventbridge':
      return parseEventBridge(expr);
    case 'github':
    case 'github-actions':
      return analyzeGitHubActions(expr);
    case 'kubernetes':
    case 'k8s':
      return analyzeKubernetes(expr);
    default:
      throw new Error(`Unknown dialect "${dialect}". Use: eventbridge, github, kubernetes`);
  }
}

export function formatProResult(result) {
  const lines = [];
  lines.push(`Dialect:  ${result.dialect}`);
  lines.push(`Pattern:  ${result.expression}`);
  lines.push(`Meaning:  ${result.meaning}`);
  if (result.warnings?.length) {
    lines.push('');
    lines.push('Warnings:');
    for (const w of result.warnings) lines.push(`  ⚠  ${w}`);
  }
  if (result.notes?.length) {
    lines.push('');
    lines.push('Notes:');
    for (const n of result.notes) lines.push(`  •  ${n}`);
  }
  lines.push('');
  lines.push(`Docs:     ${result.docs}`);
  return lines.join('\n');
}
