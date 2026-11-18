import {describe, expect, it} from 'vitest';
import {
  currentReportPeriod,
  formatYMD,
  getRecordPeriod,
  parseYMD,
  periodRangeLabel,
  periodWeeks,
  todayYMD,
} from './period';

describe('parseYMD / formatYMD', () => {
  it('round-trips a date without drifting through UTC', () => {
    expect(formatYMD(parseYMD('2026-09-07') as Date)).toBe('2026-09-07');
    expect(formatYMD(parseYMD('2026-01-01') as Date)).toBe('2026-01-01');
    expect(formatYMD(parseYMD('2026-12-31') as Date)).toBe('2026-12-31');
  });

  it('parses in local time, so the day never shifts', () => {
    const d = parseYMD('2026-03-01') as Date;
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(2);
  });

  it('rejects anything that is not y-m-d', () => {
    expect(parseYMD('2026-09')).toBeNull();
    expect(parseYMD('')).toBeNull();
    expect(parseYMD('besok')).toBeNull();
  });
});

describe('todayYMD', () => {
  it('uses the local day, not the UTC day', () => {
    // 23:30 on 31 Dec local is still 31 Dec; toISOString() would say 1 Jan
    // for anyone east of UTC, which is what the app used to do.
    const lateNye = new Date(2026, 11, 31, 23, 30);
    expect(todayYMD(lateNye)).toBe('2026-12-31');
  });

  it('handles the early morning, where the old UTC version said "yesterday"', () => {
    const earlyMorning = new Date(2026, 9, 25, 1, 15);
    expect(todayYMD(earlyMorning)).toBe('2026-10-25');
  });
});

const periodOf = (date: string) => {
  const period = getRecordPeriod(date);
  if (!period) throw new Error(`${date} has no period`);
  return period;
};

describe('getRecordPeriod', () => {
  // A period is whole Ahad-Sabtu weeks, starting on the Sunday dated 13-19:
  // the week that contains the 19th opens the next period.
  it.each([
    ['2026-09-01', 'Agustus - September 2026', '2026-08-16', '2026-09-12', 4],
    ['2026-10-01', 'September - Oktober 2026', '2026-09-13', '2026-10-17', 5],
    ['2026-11-01', 'Oktober - November 2026', '2026-10-18', '2026-11-14', 4],
    ['2026-12-01', 'November - Desember 2026', '2026-11-15', '2026-12-12', 4],
    ['2027-01-01', 'Desember 2026 - Januari 2027', '2026-12-13', '2027-01-16', 5],
  ])('puts %s in %s', (date, label, start, end, weekCount) => {
    const period = periodOf(date);
    expect(period.label).toBe(label);
    expect(period.start).toBe(start);
    expect(period.end).toBe(end);
    expect(periodWeeks(period)).toHaveLength(weekCount);
  });

  it('changes period on the Sunday of the week with the 19th, not a day before', () => {
    expect(periodOf('2026-09-12').label).toBe('Agustus - September 2026');
    expect(periodOf('2026-09-13').label).toBe('September - Oktober 2026');
    expect(periodOf('2026-11-14').label).toBe('Oktober - November 2026');
    expect(periodOf('2026-11-15').label).toBe('November - Desember 2026');
    // The 19th itself always opens the next period.
    expect(periodOf('2026-11-19').label).toBe('November - Desember 2026');
  });

  it('keys a period by the month it ends in', () => {
    expect(periodOf('2026-10-01').key).toBe('2026-10');
    expect(periodOf('2026-09-01').key).toBe('2026-09');
    expect(periodOf('2026-12-25').key).toBe('2027-01');
    expect(periodOf('2026-12-25')).toMatchObject({year: 2027, month: 1});
  });

  it('never produces a key the two-month periods used', () => {
    // Old keys were "2026-0" … "2026-5"; saved Excel drafts still carry them.
    for (let m = 0; m < 12; m++) {
      expect(periodOf(formatYMD(new Date(2026, m, 1))).key).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it('returns null for something that is not a date', () => {
    expect(getRecordPeriod('')).toBeNull();
    expect(getRecordPeriod('besok')).toBeNull();
  });

  it('puts every day of three years in exactly one period and one week', () => {
    let previous = periodOf('2025-01-01');
    for (let i = 0; i < 365 * 3; i++) {
      const date = formatYMD(new Date(2025, 0, 1 + i));
      const period = periodOf(date);

      expect(date >= period.start && date <= period.end, date).toBe(true);
      const covering = periodWeeks(period).filter((w) => date >= w.start && date <= w.end);
      expect(covering, `${date} is in no week, or in two`).toHaveLength(1);

      if (period.key !== previous.key) {
        // Periods join end to start; a new one opens on the Sunday dated
        // 13-19 and ends on the Saturday dated 12-18, before the 19th.
        const start = parseYMD(period.start) as Date;
        const end = parseYMD(period.end) as Date;
        const dayBefore = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
        expect(formatYMD(dayBefore)).toBe(previous.end);
        expect(start.getDay()).toBe(0);
        expect(start.getDate()).toBeGreaterThanOrEqual(13);
        expect(start.getDate()).toBeLessThanOrEqual(19);
        expect(end.getDay()).toBe(6);
        expect(end.getDate()).toBeGreaterThanOrEqual(12);
        expect(end.getDate()).toBeLessThanOrEqual(18);
        previous = period;
      }
    }
  });
});

describe('currentReportPeriod', () => {
  it('is the period today falls in', () => {
    expect(currentReportPeriod(new Date(2026, 10, 14, 23, 30)).label).toBe('Oktober - November 2026');
    expect(currentReportPeriod(new Date(2026, 10, 15, 0, 30)).label).toBe('November - Desember 2026');
  });
});

describe('periodWeeks', () => {
  const oktNov = periodOf('2026-11-01');

  it('runs whole Ahad-Sabtu weeks from the start of the period to its end', () => {
    expect(periodWeeks(oktNov).map((w) => w.title)).toEqual([
      '18-24 Oktober 2026',
      '25-31 Oktober 2026',
      '1-7 November 2026',
      '8-14 November 2026',
    ]);
  });

  it('numbers the blocks and marks the first', () => {
    const weeks = periodWeeks(oktNov);
    expect(weeks.map((w) => w.id)).toEqual([1, 2, 3, 4]);
    expect(weeks.map((w) => w.isWeek1)).toEqual([true, false, false, false]);
    expect(weeks[0]).toMatchObject({start: '2026-10-18', end: '2026-10-24'});
  });

  it('adds a fifth week when the period is 35 days', () => {
    const weeks = periodWeeks(periodOf('2026-10-01'));
    expect(weeks).toHaveLength(5);
    expect(weeks[0].title).toBe('13-19 September 2026');
    expect(weeks[4].title).toBe('11-17 Oktober 2026');
  });

  it('is only ever four or five whole Ahad-Sabtu weeks', () => {
    for (let m = 0; m < 120; m++) {
      const weeks = periodWeeks(periodOf(formatYMD(new Date(2020, m, 1))));
      expect([4, 5]).toContain(weeks.length);
      for (const w of weeks) {
        expect((parseYMD(w.start) as Date).getDay(), w.start).toBe(0);
        expect((parseYMD(w.end) as Date).getDay(), w.end).toBe(6);
      }
    }
  });

  it('titles a week that crosses the new year with the year it starts in', () => {
    const weeks = periodWeeks(periodOf('2027-01-01'));
    expect(weeks[2].title).toBe('27 Desember-2 Januari 2026');
    expect(weeks[2].end).toBe('2027-01-02');
  });
});

describe('periodRangeLabel', () => {
  it('shows the dates and the number of weeks', () => {
    expect(periodRangeLabel(periodOf('2026-11-01'))).toBe('18 Okt – 14 Nov 2026 · 4 pekan');
    expect(periodRangeLabel(periodOf('2026-10-01'))).toBe('13 Sep – 17 Okt 2026 · 5 pekan');
  });

  it('names both years when the period crosses one', () => {
    expect(periodRangeLabel(periodOf('2027-01-01'))).toBe('13 Des 2026 – 16 Jan 2027 · 5 pekan');
  });
});
