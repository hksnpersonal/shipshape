/**
 * Wall-clock time and calendar-date helpers. Everything here is pure: callers pass
 * `now`/`today` rather than this module reading the clock itself (the sole exception
 * is `todayIn`'s optional `now` parameter, which defaults for production callers but
 * is always supplied explicitly in tests).
 */
import { TZDate } from '@date-fns/tz';
import type { Day, ISODate, LocalTime, Trip, Weekday } from '@/domain/types';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `HH:mm` -> minutes from midnight. Returns null for anything unparseable. */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = TIME_RE.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes from midnight -> `HH:mm`. Values past midnight wrap. */
export function fromMinutes(mins: number): string {
  const wrapped = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Adds `n` minutes to a wall-clock time, wrapping across midnight. */
export function addMinutes(t: LocalTime, n: number): LocalTime {
  const base = toMinutes(t);
  if (base === null) throw new Error(`addMinutes: invalid time "${t}"`);
  return fromMinutes(base + n);
}

/** The IANA zone that applies to a Day: its own override, else the Trip default. */
export function dayTimeZone(trip: Trip, day: Day): string {
  return day.timeZone ?? trip.defaultTimeZone;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function splitISODate(date: ISODate): DateParts {
  const parts = date.split('-');
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

function splitLocalTime(time: LocalTime): { hours: number; minutes: number } {
  const parts = time.split(':');
  return { hours: Number(parts[0]), minutes: Number(parts[1]) };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromParts(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

/** The instant a Day's wall-clock `time` refers to, in that Day's effective time zone. */
export function instantOf(day: Day, time: LocalTime, trip: Trip): Date {
  const tz = dayTimeZone(trip, day);
  const { year, month, day: dom } = splitISODate(day.date);
  const { hours, minutes } = splitLocalTime(time);
  return new TZDate(year, month - 1, dom, hours, minutes, tz);
}

/** Today's calendar date as seen from `tz`. `now` defaults to the current instant. */
export function todayIn(tz: string, now: Date = new Date()): ISODate {
  const local = new TZDate(now, tz);
  return isoFromParts(local.getFullYear(), local.getMonth() + 1, local.getDate());
}

const WEEKDAY_CODES: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function weekdayFromDow(dow: number): Weekday {
  switch (dow) {
    case 0:
      return 'sun';
    case 1:
      return 'mon';
    case 2:
      return 'tue';
    case 3:
      return 'wed';
    case 4:
      return 'thu';
    case 5:
      return 'fri';
    case 6:
      return 'sat';
    default:
      throw new Error(`weekdayFromDow: invalid day-of-week index ${dow}`);
  }
}

/** The weekday of an ISODate, independent of any time zone. */
export function weekdayOf(date: ISODate): Weekday {
  const { year, month, day } = splitISODate(date);
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekdayFromDow(dow);
}

/** Calendar days from `a` to `b` (positive when `b` is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  const pa = splitISODate(a);
  const pb = splitISODate(b);
  const ta = Date.UTC(pa.year, pa.month - 1, pa.day);
  const tb = Date.UTC(pb.year, pb.month - 1, pb.day);
  return Math.round((tb - ta) / 86_400_000);
}

/** `date` shifted by `n` calendar days (negative moves earlier). */
export function addDays(date: ISODate, n: number): ISODate {
  const p = splitISODate(date);
  const t = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
  return isoFromParts(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function weekdayLabel(w: Weekday): string {
  switch (w) {
    case 'mon':
      return 'Mon';
    case 'tue':
      return 'Tue';
    case 'wed':
      return 'Wed';
    case 'thu':
      return 'Thu';
    case 'fri':
      return 'Fri';
    case 'sat':
      return 'Sat';
    case 'sun':
      return 'Sun';
  }
}

function monthLabel(month: number): string {
  switch (month) {
    case 1:
      return 'Jan';
    case 2:
      return 'Feb';
    case 3:
      return 'Mar';
    case 4:
      return 'Apr';
    case 5:
      return 'May';
    case 6:
      return 'Jun';
    case 7:
      return 'Jul';
    case 8:
      return 'Aug';
    case 9:
      return 'Sep';
    case 10:
      return 'Oct';
    case 11:
      return 'Nov';
    case 12:
      return 'Dec';
    default:
      throw new Error(`monthLabel: invalid month ${month}`);
  }
}

/** Human label for a date, e.g. `Sat 26 Sep`. */
export function formatDayLabel(date: ISODate): string {
  const { month, day } = splitISODate(date);
  return `${weekdayLabel(weekdayOf(date))} ${day} ${monthLabel(month)}`;
}

export { WEEKDAY_CODES };
