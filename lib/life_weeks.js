// Pure date math for the "life in weeks" grid. Works on the server and in the browser.
// Each row is one year of age (birthday to birthday); each row has 52 weeks.
// The leftover 1-2 days at the end of a year of age fold into week 51.

export const WEEKS_PER_YEAR = 52;
const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseDate = (value) => {
    if (value instanceof Date) {
        return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }
    const match = DATE_RE.exec(String(value || '').slice(0, 10));
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (date.getUTCMonth() !== Number(match[2]) - 1) return null;
    return date;
};

export const formatDate = (date) => date.toISOString().slice(0, 10);

export const isValidDateString = (value) => parseDate(value) !== null;

// Birthday `years` after `birth`; Feb 29 birthdays fall on Feb 28 in non-leap years.
export const addYears = (birth, years) => {
    const target_year = birth.getUTCFullYear() + years;
    const date = new Date(Date.UTC(target_year, birth.getUTCMonth(), birth.getUTCDate()));
    if (date.getUTCMonth() !== birth.getUTCMonth()) {
        return new Date(Date.UTC(target_year, birth.getUTCMonth() + 1, 0));
    }
    return date;
};

export const weekKey = (year, week) => `${year}-${week}`;

// Which (year of age, week) a date falls in, or null if before birth.
export const weekOf = (birth_value, date_value) => {
    const birth = parseDate(birth_value);
    const date = parseDate(date_value);
    if (!birth || !date || date < birth) return null;
    let year = date.getUTCFullYear() - birth.getUTCFullYear();
    if (addYears(birth, year) > date) year -= 1;
    const year_start = addYears(birth, year);
    const days = Math.round((date - year_start) / DAY_MS);
    const week = Math.min(Math.floor(days / 7), WEEKS_PER_YEAR - 1);
    return { year, week };
};

// Date range covered by a cell. `end` is exclusive.
export const weekRange = (birth_value, year, week) => {
    const birth = parseDate(birth_value);
    const year_start = addYears(birth, year);
    const start = new Date(year_start.getTime() + week * 7 * DAY_MS);
    const end = week === WEEKS_PER_YEAR - 1
        ? addYears(birth, year + 1)
        : new Date(year_start.getTime() + (week + 1) * 7 * DAY_MS);
    return { start: formatDate(start), end: formatDate(end) };
};

// Inclusive last day of a cell, for display.
export const weekLastDay = (birth_value, year, week) => {
    const { end } = weekRange(birth_value, year, week);
    return formatDate(new Date(parseDate(end).getTime() - DAY_MS));
};

// Calendar date (YYYY-MM-DD) of an instant in a given IANA time zone.
export const localDateOf = (instant, time_zone) => {
    const date = instant instanceof Date ? instant : new Date(instant);
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: time_zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(date);
    } catch {
        return formatDate(date);
    }
};

export const todayString = () => localDateOf(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);

// Picks which new photos fit under a per-week limit. `items` are
// { date: 'YYYY-MM-DD', ... } in the order they should be preferred;
// `existing_days` are { day, count } rows already stored.
export const selectWithinWeeklyCap = ({ birth_date, items, existing_days, cap }) => {
    const counts = new Map();
    for (const { day, count } of existing_days) {
        const position = weekOf(birth_date, day);
        if (!position) continue;
        const key = weekKey(position.year, position.week);
        counts.set(key, (counts.get(key) || 0) + count);
    }

    const accepted = [];
    let over_cap = 0;
    let before_birth = 0;
    for (const item of items) {
        const position = weekOf(birth_date, item.date);
        if (!position) {
            before_birth += 1;
            continue;
        }
        const key = weekKey(position.year, position.week);
        const count = counts.get(key) || 0;
        if (count >= cap) {
            over_cap += 1;
            continue;
        }
        counts.set(key, count + 1);
        accepted.push(item);
    }
    return { accepted, over_cap, before_birth };
};
