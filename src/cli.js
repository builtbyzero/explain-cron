#!/usr/bin/env node
import { explain, formatResult } from './index.js';

const USAGE = `cron-explain — explain a cron expression in plain English

Usage:
  cron-explain "<cron expression>" [--count N] [--tz <IANA-tz>]
  cron-explain --pro
  cron-explain --help
  cron-explain --version

Examples:
  cron-explain "*/5 * * * *"
  cron-explain "0 9 * * 1-5"
  cron-explain "0 0 1 * *" --tz America/Denver --count 10

Options:
  -n, --count N     How many next run times to show (1-100, default 10)
      --tz TZ       IANA timezone for next-run calculations
      --pro         Info about the Pro tier (AWS EventBridge, GH Actions, k8s)
  -h, --help        Show this help
  -v, --version     Show version

Free tier: standard 5-field cron syntax.
Pro tier:  AWS EventBridge (6-field), GitHub Actions quirks, k8s CronJob
           syntax — get early access at https://builtbyzero.com
`;

const PRO_MESSAGE = `cron-explain Pro — coming soon

The Pro tier explains the cron dialects that trip people up:
  • AWS EventBridge (6-field, with year + special day-of-week tokens)
  • GitHub Actions (UTC-only, 5-min minimum, quirks around workflow_dispatch)
  • Kubernetes CronJob (timezone field, concurrency policy gotchas)

Get early access for $9 (one-time) at https://builtbyzero.com
`;

function parseArgs(argv) {
  const out = { count: 10, help: false, version: false, pro: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      out.help = true;
    } else if (a === '-v' || a === '--version') {
      out.version = true;
    } else if (a === '--pro') {
      out.pro = true;
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
    } else if (a?.startsWith('-')) {
      throw new Error(`Unknown option: ${a}`);
    } else if (a !== undefined) {
      positional.push(a);
    }
  }
  out.expression = positional.join(' ').trim() || undefined;
  return out;
}

export function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n\n${USAGE}`);
    return 2;
  }

  if (args.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`cron-explain 0.1.0\n`);
    return 0;
  }
  if (args.pro) {
    process.stdout.write(PRO_MESSAGE);
    return 0;
  }
  if (!args.expression) {
    process.stderr.write(`error: missing cron expression\n\n${USAGE}`);
    return 2;
  }

  try {
    const result = explain(args.expression, { count: args.count, tz: args.tz });
    process.stdout.write(formatResult(result, { tz: args.tz }) + '\n');
    return 0;
  } catch (err) {
    process.stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  /cli\.js$/.test(process.argv[1]);

if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
