# cron-plain

> Explain any cron expression in plain English. Show the next 10 run times. Zero config.

```
$ npx cron-plain "*/5 * * * *"

Expression: */5 * * * *
Meaning:    Every 5 minutes

Next 10 run times (local time):
   1. Mon, May 18, 2026, 23:20 MDT
   2. Mon, May 18, 2026, 23:25 MDT
   3. Mon, May 18, 2026, 23:30 MDT
   ...
```

## Install

Run it on the fly:

```bash
npx cron-plain "0 9 * * 1-5"
```

Or install globally:

```bash
npm install -g cron-plain
cron-plain "@daily"
```

Requires Node.js 18 or newer.

## Usage

```
cron-plain "<cron expression>" [--count N] [--tz <IANA-tz>]
cron-plain --pro
cron-plain --help
cron-plain --version
```

Examples:

```bash
cron-plain "*/15 * * * *"
cron-plain "0 9 * * 1-5"                    # weekdays at 9am
cron-plain "0 0 1 * *" --tz America/Denver  # midnight, 1st of every month, in Denver
cron-plain "@daily" --count 3
```

### Programmatic API

```js
import { explain, formatResult } from 'cron-plain';

const result = explain('*/5 * * * *', { count: 10, tz: 'UTC' });
console.log(result.description);  // "Every 5 minutes"
console.log(result.nextRuns);     // Date[]
console.log(formatResult(result, { tz: 'UTC' }));
```

## Free vs Pro

**Free (this package):** standard 5-field cron syntax — `minute hour day-of-month month day-of-week` — plus common `@aliases` (`@daily`, `@hourly`, etc.).

**Pro ($9, one-time):** the cron dialects that trip people up.

- **AWS EventBridge** — 6-field syntax, `?` placeholders, year field, and the day-of-week-vs-day-of-month exclusivity rule
- **GitHub Actions** — UTC-only, 5-minute minimum interval, quirks with `workflow_dispatch`
- **Kubernetes CronJob** — `spec.timeZone` field, `concurrencyPolicy` gotchas, `startingDeadlineSeconds`

Pro lands soon. Get early access at **[builtbyzero.com](https://builtbyzero.com)**.

```bash
cron-plain --pro
```

## Why this exists

Every dev has copy-pasted a cron expression they only half-understand. `cron-plain` is the 5-second sanity check before you ship the job that wakes you up at 3am.

## License

MIT © [builtbyzero](https://builtbyzero.com)
