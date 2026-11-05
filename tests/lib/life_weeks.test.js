import { describe, it, expect } from 'vitest';
import { weekOf, weekRange, weekLastDay, addYears, parseDate, localDateOf } from '../../lib/life_weeks.js';

describe('lib/life_weeks', () => {
    it('places the birth date in year 0 week 0', () => {
        expect(weekOf('1990-06-15', '1990-06-15')).toEqual({ year: 0, week: 0 });
    });

    it('returns null for dates before birth', () => {
        expect(weekOf('1990-06-15', '1990-06-14')).toBeNull();
    });

    it('starts a new row on each birthday', () => {
        expect(weekOf('1990-06-15', '1991-06-14')).toEqual({ year: 0, week: 51 });
        expect(weekOf('1990-06-15', '1991-06-15')).toEqual({ year: 1, week: 0 });
        expect(weekOf('1990-06-15', '2020-06-22')).toEqual({ year: 30, week: 1 });
    });

    it('folds the final days of a year into week 51', () => {
        const range = weekRange('1990-06-15', 0, 51);
        expect(range).toEqual({ start: '1991-06-07', end: '1991-06-15' });
        expect(weekLastDay('1990-06-15', 0, 51)).toBe('1991-06-14');
    });

    it('round-trips every day of a year through weekOf and weekRange', () => {
        const birth = '1992-02-29';
        for (let day = 0; day < 800; day += 1) {
            const date = new Date(parseDate('1995-01-01').getTime() + day * 86400000).toISOString().slice(0, 10);
            const { year, week } = weekOf(birth, date);
            const { start, end } = weekRange(birth, year, week);
            expect(date >= start && date < end).toBe(true);
        }
    });

    it('handles leap-day birthdays', () => {
        expect(addYears(parseDate('1992-02-29'), 1).toISOString().slice(0, 10)).toBe('1993-02-28');
        expect(addYears(parseDate('1992-02-29'), 4).toISOString().slice(0, 10)).toBe('1996-02-29');
    });

    it('converts instants to local dates', () => {
        expect(localDateOf('2024-01-01T02:00:00Z', 'America/New_York')).toBe('2023-12-31');
        expect(localDateOf('2024-01-01T02:00:00Z', 'UTC')).toBe('2024-01-01');
    });
});
