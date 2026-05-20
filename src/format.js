// Tiny zero-dep ANSI color + layout helpers for cron-plain output.
// Honors NO_COLOR, --no-color, non-TTY stdout, and FORCE_COLOR.

const ESC = '\x1b[';

function shouldColor(opts = {}) {
  if (opts.color === false) return false;
  if (opts.color === true) return true;
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') return true;
  if (process.env.NO_COLOR) return false;
  // Default: color only when stdout is a TTY.
  return Boolean(process.stdout && process.stdout.isTTY);
}

/** Build a colorizer that no-ops when color is disabled. */
export function makeColors(opts = {}) {
  const on = shouldColor(opts);
  const wrap = (code) => (s) =>
    on ? `${ESC}${code}m${s}${ESC}0m` : String(s);
  return {
    enabled: on,
    bold: wrap('1'),
    dim: wrap('2'),
    italic: wrap('3'),
    red: wrap('31'),
    green: wrap('32'),
    yellow: wrap('33'),
    cyan: wrap('36'),
    boldCyan: wrap('1;36'),
    dimItalic: wrap('2;3'),
  };
}

/** Strip ANSI sequences (useful for tests). */
export function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

/** Render a labelled section: header on its own line, body indented 2 sp. */
export function section(c, header, bodyLines) {
  const out = [c.boldCyan(header)];
  for (const line of bodyLines) out.push('  ' + line);
  return out;
}
