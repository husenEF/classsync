/**
 * Monthly reporting periods and their weekly blocks.
 *
 * A report is whole Ahad-Sabtu weeks. The week that contains the 19th is not
 * in the period that ends that month; it opens the next one. So a period
 * starts on the Sunday that falls on the 13th-19th — there is exactly one —
 * and runs until the day before the next such Sunday. That is 28 or 35 days:
 * four weeks, or five when the calendar needs the extra one:
 *
 *   Agustus - September 2026   16 Agu - 12 Sep   4 pekan
 *   September - Oktober 2026   13 Sep - 17 Okt   5 pekan
 *   Oktober - November 2026    18 Okt - 14 Nov   4 pekan
 *
 * Periods join end to start, so every date is in exactly one period and one
 * week, whatever sessions exist.
 *
 * Dates are parsed component-wise and local, never with
 * `new Date("YYYY-MM-DD")`, which is UTC midnight and shifts the day west of
 * UTC.
 */

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const;

/** A period never starts before this day of the month… */
const BOUNDARY_FIRST_DAY = 13;
/** …and its weeks start on this weekday (0 = Ahad). */
const WEEK_START_DAY = 0;

export type ReportPeriod = {
  /** Year and month (1-12) the period ends in. */
  year: number;
  month: number;
  /** "YYYY-MM" of the month it ends in. */
  key: string;
  /** "September - Oktober 2026". */
  label: string;
  /** Inclusive "YYYY-MM-DD". */
  start: string;
  /** Inclusive "YYYY-MM-DD". */
  end: string;
};

export type WeekBlock = {
  id: number;
  title: string;
  /** Inclusive "YYYY-MM-DD". */
  start: string;
  /** Inclusive "YYYY-MM-DD". */
  end: string;
  isWeek1: boolean;
};

/** Parse "YYYY-MM-DD" as a local date. Returns null if it is not that shape. */
export function parseYMD(dateStr: string): Date | null {
  const parts = dateStr?.split('-');
  if (!parts || parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => parseInt(p, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a local Date back to "YYYY-MM-DD" without going through UTC. */
export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today in local time. The app used `toISOString()`, which is UTC. */
export function todayYMD(now: Date = new Date()): string {
  return formatYMD(now);
}

/**
 * The day a new period starts in a month: the Sunday on the 13th-19th, which
 * opens the week that contains the 19th.
 * `monthIndex` is 0-based and may overflow (-1 is last December).
 */
function periodBoundary(year: number, monthIndex: number): Date {
  const first = new Date(year, monthIndex, BOUNDARY_FIRST_DAY);
  const offset = (WEEK_START_DAY - first.getDay() + 7) % 7;
  return new Date(first.getFullYear(), first.getMonth(), BOUNDARY_FIRST_DAY + offset);
}

/** The period that ends in the given month. `monthIndex` is 0-based and may overflow. */
function periodEndingIn(year: number, monthIndex: number): ReportPeriod {
  const start = periodBoundary(year, monthIndex - 1);
  const next = periodBoundary(year, monthIndex);
  const end = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);

  const startMonth = INDONESIAN_MONTHS[start.getMonth()];
  const endMonth = INDONESIAN_MONTHS[end.getMonth()];
  const label =
    start.getFullYear() === end.getFullYear()
      ? `${startMonth} - ${endMonth} ${end.getFullYear()}`
      : `${startMonth} ${start.getFullYear()} - ${endMonth} ${end.getFullYear()}`;

  return {
    year: end.getFullYear(),
    month: end.getMonth() + 1,
    key: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`,
    label,
    start: formatYMD(start),
    end: formatYMD(end),
  };
}

/** The period a date falls in, or null if the date is not "YYYY-MM-DD". */
export function getRecordPeriod(dateStr: string): ReportPeriod | null {
  const date = parseYMD(dateStr);
  if (!date) return null;
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  // On or after this month's boundary, the date opens the period that ends
  // next month; before it, it closes the one that ends this month.
  const startsNext = date.getTime() >= periodBoundary(year, monthIndex).getTime();
  return periodEndingIn(year, startsNext ? monthIndex + 1 : monthIndex);
}

/** The period today falls in. */
export function currentReportPeriod(now: Date = new Date()): ReportPeriod {
  return getRecordPeriod(formatYMD(now)) as ReportPeriod;
}

function weekTitle(start: Date, end: Date): string {
  const startMonth = INDONESIAN_MONTHS[start.getMonth()];
  const endMonth = INDONESIAN_MONTHS[end.getMonth()];
  const startYear = start.getFullYear();

  return startMonth === endMonth
    ? `${start.getDate()}-${end.getDate()} ${startMonth} ${startYear}`
    : `${start.getDate()} ${startMonth}-${end.getDate()} ${endMonth} ${startYear}`;
}

/** The weekly blocks of a period: four, or five when the period is 35 days. */
export function periodWeeks(period: Pick<ReportPeriod, 'start' | 'end'>): WeekBlock[] {
  const first = parseYMD(period.start);
  if (!first) return [];

  const weeks: WeekBlock[] = [];
  for (let i = 0; ; i++) {
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i * 7);
    if (formatYMD(start) > period.end) break;
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

    weeks.push({
      id: i + 1,
      title: weekTitle(start, end),
      start: formatYMD(start),
      end: formatYMD(end),
      isWeek1: i === 0,
    });
  }
  return weeks;
}

/** "18 Okt – 14 Nov 2026 · 4 pekan", shown under the period picker. */
export function periodRangeLabel(period: Pick<ReportPeriod, 'start' | 'end'>): string {
  const start = parseYMD(period.start);
  const end = parseYMD(period.end);
  if (!start || !end) return '';

  const day = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
  const from =
    start.getFullYear() === end.getFullYear() ? day(start) : `${day(start)} ${start.getFullYear()}`;
  return `${from} – ${day(end)} ${end.getFullYear()} · ${periodWeeks(period).length} pekan`;
}
