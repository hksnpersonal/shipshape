/**
 * Opening hours written by a person, turned into something a rule can check.
 *
 * The source notes contain forms like "Tue-Sun 09:00-19:00, closed Mondays", "~09:30-18:00
 * seasonal", and the plainly wrong "10:15-3:45". The parser never repairs a bad range: it
 * reports an issue and lowers its confidence so the linter can raise it with the traveller.
 */
import { toMinutes } from '@/domain/time';
import type { LocalTime, OpeningHours, OpeningRule, Weekday } from '@/domain/types';

const ORDER: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const DAY_WORDS: ReadonlyArray<readonly [RegExp, Weekday]> = [
  [/^(mondays?|mon|mo)$/, 'mon'],
  [/^(tuesdays?|tues|tue|tu)$/, 'tue'],
  [/^(wednesdays?|weds|wed|we)$/, 'wed'],
  [/^(thursdays?|thurs|thur|thu|th)$/, 'thu'],
  [/^(fridays?|fri|fr)$/, 'fri'],
  [/^(saturdays?|sat|sa)$/, 'sat'],
  [/^(sundays?|sun|su)$/, 'sun'],
];

/** `Tuesday` / `tues` / `TU` -> `'tue'`. */
export function parseWeekday(word: string): Weekday | undefined {
  const w = word.trim().toLowerCase().replace(/\.$/, '');
  for (const [re, day] of DAY_WORDS) if (re.test(w)) return day;
  return undefined;
}

/** Inclusive weekday range, wrapping across the end of the week (`sat-mon`). */
function expandRange(from: Weekday, to: Weekday): Weekday[] {
  const start = ORDER.indexOf(from);
  const end = ORDER.indexOf(to);
  const out: Weekday[] = [];
  for (let i = 0; i < ORDER.length; i += 1) {
    const day = ORDER[(start + i) % ORDER.length];
    if (day !== undefined) out.push(day);
    if ((start + i) % ORDER.length === end) break;
  }
  return out;
}

/** Normalise the dash and space characters a person might type. */
function normalise(raw: string): string {
  return raw
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\bto\b/gi, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `9`, `9:00`, `09.00`, `9am`, `3:45` -> `HH:mm`, or undefined. */
function parseClock(token: string): LocalTime | undefined {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i.exec(token.trim());
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface ParsedHours {
  hours?: OpeningHours;
  issues: string[];
}

const ALL_DAYS: Weekday[] = [...ORDER];

/**
 * Parse a free-text opening-hours string.
 *
 * Issues it can report: `no-time-range`, `close-before-open`, `unparseable-day`.
 * Anything with an issue comes back with `confidence: 'guess'`.
 */
export function parseOpeningHours(raw: string): ParsedHours {
  const issues: string[] = [];
  const text = normalise(raw);
  const lower = text.toLowerCase();

  const seasonal = /seasonal|summer|winter|in season/.test(lower);
  const approximate = raw.includes('~') || /\babout\b|\baround\b/.test(lower);

  // "open 24 h" / "24 hours" / "always open"
  if (/24\s*(h|hr|hrs|hours)|always open|open 24/.test(lower)) {
    return {
      hours: {
        rules: [{ days: ALL_DAYS, open: '00:00', close: '23:59' }],
        rawText: raw,
        confidence: 'notes',
        ...(seasonal ? { seasonal: true } : {}),
        note: 'Open 24 hours',
      },
      issues,
    };
  }

  // "closed Mondays", "closed on Mon and Tue"
  const closedOn: Weekday[] = [];
  const closedMatch = /closed\s+(?:on\s+)?([a-z ,and]+)/i.exec(text);
  if (closedMatch?.[1]) {
    for (const word of closedMatch[1].split(/[,\s]+|\band\b/)) {
      const day = parseWeekday(word);
      if (day && !closedOn.includes(day)) closedOn.push(day);
    }
  }

  // Every "HH:mm-HH:mm" range in the string, each optionally preceded by day words.
  const rules: OpeningRule[] = [];
  const rangeRe =
    /(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*-\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)/gi;
  let match: RegExpExecArray | null;
  while ((match = rangeRe.exec(text)) !== null) {
    const open = parseClock(match[1] ?? '');
    const close = parseClock(match[2] ?? '');
    if (!open || !close) {
      issues.push('no-time-range');
      continue;
    }
    const openMin = toMinutes(open);
    const closeMin = toMinutes(close);
    if (openMin !== null && closeMin !== null && closeMin <= openMin) {
      issues.push('close-before-open');
    }

    // Day words appearing before this range, since the previous range ended.
    const preceding = text.slice(0, match.index);
    const days = daysFrom(preceding, issues);
    rules.push({ days: days.length ? days : ALL_DAYS, open, close });
  }

  if (rules.length === 0) {
    issues.push('no-time-range');
    return { issues };
  }

  const applicable = closedOn.length
    ? rules.map((r) => ({ ...r, days: r.days.filter((d) => !closedOn.includes(d)) }))
    : rules;

  return {
    hours: {
      rules: applicable,
      ...(closedOn.length ? { closedOn } : {}),
      ...(seasonal ? { seasonal: true } : {}),
      rawText: raw,
      confidence: issues.length || approximate ? 'guess' : 'notes',
    },
    issues,
  };
}

/** Day words in a fragment, expanding `Tue-Sun` into the days it covers. */
function daysFrom(fragment: string, issues: string[]): Weekday[] {
  // Only look at the tail after the last comma or semicolon, so "Mon-Sat 09:00-19:00,
  // Sun 10:00-14:00" attributes each range to its own days.
  const tail = fragment.split(/[,;]/).pop() ?? fragment;
  const cleaned = tail.replace(/closed\s+(?:on\s+)?[a-z ,and]+/gi, ' ');
  const days: Weekday[] = [];
  const rangeRe = /([a-z]{2,9})\s*-\s*([a-z]{2,9})/gi;
  let m: RegExpExecArray | null;
  let consumed = cleaned;
  while ((m = rangeRe.exec(cleaned)) !== null) {
    const from = parseWeekday(m[1] ?? '');
    const to = parseWeekday(m[2] ?? '');
    if (from && to) {
      for (const d of expandRange(from, to)) if (!days.includes(d)) days.push(d);
      consumed = consumed.replace(m[0], ' ');
    }
  }
  for (const word of consumed.split(/[^a-z]+/i)) {
    if (!word) continue;
    const day = parseWeekday(word);
    if (day && !days.includes(day)) days.push(day);
  }
  if (days.length === 0 && /\b(mon|tue|wed|thu|fri|sat|sun)/i.test(cleaned)) {
    issues.push('unparseable-day');
  }
  return days.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/**
 * Is the venue open? With no `time`, asks only whether it opens at all that weekday.
 * A malformed range (close before open) is treated as closed so the linter speaks up.
 */
export function isOpenOn(
  hours: OpeningHours | null | undefined,
  weekday: Weekday,
  time?: LocalTime | null,
): boolean {
  if (!hours) return true;
  if (hours.closedOn?.includes(weekday)) return false;
  const todays = hours.rules.filter((r) => r.days.includes(weekday));
  if (todays.length === 0) return false;
  if (!time) return true;
  const at = toMinutes(time);
  if (at === null) return true;
  return todays.some((r) => {
    const open = toMinutes(r.open);
    const close = toMinutes(r.close);
    if (open === null || close === null || close <= open) return false;
    return at >= open && at < close;
  });
}

const LABELS: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** A short human summary, e.g. `Tue-Sun 09:00-19:00, closed Mon`. */
export function describeHours(hours: OpeningHours): string {
  const parts = hours.rules.map((rule) => {
    const days = rule.days.map((d) => LABELS[d]);
    const span =
      rule.days.length === 7
        ? 'Daily'
        : rule.days.length > 2 && isContiguous(rule.days)
          ? `${days[0]}-${days[days.length - 1]}`
          : days.join(', ');
    return `${span} ${rule.open}-${rule.close}`;
  });
  if (hours.closedOn?.length) {
    parts.push(`closed ${hours.closedOn.map((d) => LABELS[d]).join(', ')}`);
  }
  return parts.join(', ');
}

function isContiguous(days: Weekday[]): boolean {
  const idx = days.map((d) => ORDER.indexOf(d));
  for (let i = 1; i < idx.length; i += 1) {
    const prev = idx[i - 1];
    const cur = idx[i];
    if (prev === undefined || cur === undefined || cur !== prev + 1) return false;
  }
  return true;
}
