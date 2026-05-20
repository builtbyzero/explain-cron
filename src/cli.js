#!/usr/bin/env node
// cron-plain — explain any cron expression in plain English.
// Usage: cron-plain "<expression>" [--dialect eventbridge|github|kubernetes] [--count N] [--tz TZ] [--json] [--no-color]

import { explain, formatResult, formatJson } from './index.js';
import { explainPro, formatProResult, formatProJson, detectDialect } from './pro.js';
import { makeColors } from './format.js';

const USAGE = `cron-plain — explain a cron expression in plain English

Usage:
  cron-plain "<cron expression>" [--count N] [--tz <IANA-tz>]
  cron-plain "<expression>" --dialect <eventbridge|github|kubernetes>
  cron-plain "<expression>" --json
  cron-plain --help
  cron-plain --version

Examples:
  cron-plain "*/5 * * * *"
  cron-plain "0 9 * * 1-5"
  cron-plain "0 0 1 * *" --tz America/Denver --count 10
  cron-plain "0 18 ? * MON-FRI *" --dialect eventbridge
  cron-plain "*/10 * * * *" --dialect github
  cron-plain "0 2 * * 0" --dialect kubernetes

Options:
  -n, --count N          How many next run times to show (1-100, default 10)
      --tz TZ            IANA timezone for next-run calculations
      --dialect <name>   Pro: explain dialect quirks (eventbridge, github, kubernetes)
      --json             Emit machine-readable JSON (no colors, no upsell)
      --no-color         Disable ANSI colors (also via NO_COLOR env var)
  -h, --help             Show this help
  -v, --version          Show version

Free tier: standard 5-field cron syntax.
Pro tier:  --dialect flag for AWS EventBridge, GitHub Actions, k8s CronJob quirks.
           $9 one-time → https://buy.stripe.com/dRm9AM8S29ZVcbL4k6d3i07
`;

function parseArgs(argv) {
  const out = { count: 10, help: false, version: false, dialect: null, json: false, noColor: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      out.help = true;
    } else if (a === '-v' || a === '--version') {
      out.version = true;
    } else if (a === '--dialect') {
      out.dialect = argv[++i];
    } else if (a?.startsWith('--dialect=')) {
      out.dialect = a.slice('--dialect='.length);
    } else if (a === '--json') {
      out.json = true;
    } else if (a === '--no-color' || a === '--no-colour') {
      out.noColor = true;
    } else if (a === '--count' || a === '-n') {
      const v = argv[++i];
      const n = Number.parseInt(v ?? '', 10);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        throw new Error(`--count must be an integer between 1 and 100 (got "${v}")`);
      }
      out.count = n;
    } else if (a?.startsWith('--count=')) {
      const v = a.slice('--count='.length);
      const n = Number.parseInt(v, 10);
      if (!Number.isFinite(n) || n <= 0 || n > 100) {
        throw new Error(`--count must be an integer between 1 and 100 (got "${v}")`);
      }
      out.count = n;
    } else if (a === '--tz') {
      out.tz = argv[++i];
    } else if (a?.startsWith('--tz=')) {
      out.tz = a.slice('--tz='.length);
    } else if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    } else if (!a.startsWith('-')) {
      positional.push(a);
    } else {
      throw new Error(`Unknown option "${a}"`);
    }
  }
  out.expression = positional[0] ?? null;
  return out;
}

async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n\n${USAGE}`);
    return 2;
  }

  if (args.help) { process.stdout.write(USAGE); return 0; }
  if (args.version) { process.stdout.write(`cron-plain 0.3.0\n`); return 0; }

  if (!args.expression) {
    process.stderr.write(`error: missing cron expression\n\n${USAGE}`);
    return 2;
  }

  // JSON mode forces colors off.
  const colorOpts = { color: args.noColor || args.json ? false : undefined };
  const c = makeColors(colorOpts);

  // Pro dialect path
  if (args.dialect) {
    const validDialects = ['eventbridge', 'github', 'github-actions', 'kubernetes', 'k8s'];
    if (!validDialects.includes(args.dialect)) {
      process.stderr.write(`error: unknown dialect "${args.dialect}". Valid: eventbridge, github, kubernetes\n`);
      return 1;
    }
    try {
      const result = explainPro(args.expression, args.dialect);
      if (args.json) {
        process.stdout.write(formatProJson(result) + '\n');
      } else {
        process.stdout.write(formatProResult(result, colorOpts) + '\n');
        process.stdout.write('\n' + c.dimItalic(`Pro tier — $9 one-time → https://buy.stripe.com/dRm9AM8S29ZVcbL4k6d3i07`) + '\n');
      }
      return 0;
    } catch (err) {
      process.stderr.write(`error: ${err.message}\n`);
      return 1;
    }
  }

  // Auto-detect 6-field EventBridge
  const fieldCount = args.expression.trim().split(/\s+/).length;
  if (fieldCount === 6 && !args.json) {
    process.stdout.write(c.yellow(`Note: 6-field expression detected — this looks like AWS EventBridge syntax.`) + '\n');
    process.stdout.write(c.dim(`Run with --dialect eventbridge for full analysis.`) + '\n\n');
  }

  // Standard free tier
  try {
    const result = explain(args.expression, { count: args.count, tz: args.tz });
    if (args.json) {
      process.stdout.write(formatJson(result, { tz: args.tz }) + '\n');
    } else {
      process.stdout.write(formatResult(result, { tz: args.tz, ...colorOpts }) + '\n');
      if (fieldCount === 6) {
        process.stdout.write('\n' + c.dimItalic(`Pro tip: use --dialect eventbridge for EventBridge-specific warnings.`) + '\n');
        process.stdout.write(c.dimItalic(`$9 one-time → https://buy.stripe.com/dRm9AM8S29ZVcbL4k6d3i07`) + '\n');
      }
    }
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';

const invokedDirectly = (() => {
  if (typeof process === 'undefined' || !Array.isArray(process.argv) || !process.argv[1]) return false;
  try {
    const entry = realpathSync(process.argv[1]);
    const self = realpathSync(fileURLToPath(import.meta.url));
    return entry === self;
  } catch {
    return /cli\.js$/.test(process.argv[1]);
  }
})();

if (invokedDirectly) {
  main(process.argv.slice(2)).then(code => process.exit(code ?? 0));
}

export { main };
