'use client';
import { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api.js';
import Layout from '@/components/layout.jsx';
import LifeGrid from '@/components/life_grid.jsx';
import WeekPreview from '@/components/week_preview.jsx';
import WeekPanel from '@/components/week_panel.jsx';
import GooglePhotosImport from '@/components/google_photos_import.jsx';
import {
    WEEKS_PER_YEAR, weekOf, weekKey, weekRange, weekLastDay, parseDate, todayString
} from '@/lib/life_weeks.js';

const DETAILS_TTL_MS = 50 * 60 * 1000;

const GOOGLE_MESSAGES = {
    connected: 'Google Photos connected. Use “Import from Google Photos” to pick photos.',
    photos_declined: 'You signed in without giving access to Google Photos. Click “Connect Google Photos” to allow it.',
    cancelled: 'Google Photos connection was cancelled.',
    invalid: 'That Google sign-in link expired. Please try again.',
    no_refresh_token: 'Google did not grant offline access. Remove Little Red Book from your Google account permissions and connect again.',
    missing_scope: 'Please allow access to your selected photos when connecting.',
    error: 'Something went wrong connecting Google Photos.'
};

const formatDay = (value, options) => parseDate(value).toLocaleDateString(undefined, { timeZone: 'UTC', ...options });

const weekLabel = (birth_date, { year, week }) => {
    const { start } = weekRange(birth_date, year, week);
    const last = weekLastDay(birth_date, year, week);
    const same_year = start.slice(0, 4) === last.slice(0, 4);
    return {
        title: `Age ${year} · Week ${week + 1}`,
        subtitle: `${formatDay(start, { day: 'numeric', month: 'short', ...(same_year ? {} : { year: 'numeric' }) })} – ${formatDay(last, { day: 'numeric', month: 'short', year: 'numeric' })}`
    };
};

function SetupForm({ initial, on_saved, on_cancel }) {
    // State
    const [birth_date, setBirthDate] = useState(initial?.birth_date || '');
    const [lifespan_years, setLifespan] = useState(initial?.lifespan_years || 90);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Handlers
    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            await api('/api/life', { method: 'PUT', body: { birth_date, lifespan_years: Number(lifespan_years) } });
            on_saved();
        } catch (save_error) {
            setError(save_error.message);
        } finally {
            setSaving(false);
        }
    }, [birth_date, lifespan_years, on_saved]);

    // Render
    return (
        <form onSubmit={handleSubmit} className="bg-white border-2 border-gray-200 rounded-2xl p-6 max-w-md mx-auto space-y-4">
            <div className="text-center">
                <div className="text-4xl mb-2">🗓️</div>
                <h2 className="text-xl font-bold text-gray-900">Your life in weeks</h2>
                <p className="text-gray-500 text-sm mt-1">
                    Every box is one week of your life. Add your birthday to draw yours.
                </p>
            </div>
            <label className="block text-sm font-semibold text-gray-700">
                Birth date
                <input
                    type="date"
                    required
                    max={todayString()}
                    value={birth_date}
                    onChange={(event) => setBirthDate(event.target.value)}
                    className="mt-1 w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-base font-normal"
                />
            </label>
            <label className="block text-sm font-semibold text-gray-700">
                Years to show
                <input
                    type="number"
                    min={1}
                    max={120}
                    value={lifespan_years}
                    onChange={(event) => setLifespan(event.target.value)}
                    className="mt-1 w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-base font-normal"
                />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
                {on_cancel && (
                    <button type="button" onClick={on_cancel} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg">
                        Cancel
                    </button>
                )}
                <button type="submit" disabled={saving} className="flex-1 bg-red-700 hover:bg-red-800 text-white font-bold py-3 rounded-lg disabled:opacity-60">
                    {saving ? 'Saving…' : 'Show my weeks'}
                </button>
            </div>
        </form>
    );
}

function Legend() {
    const items = [
        ['bg-gray-300', 'Lived'],
        ['bg-white border border-gray-200', 'Still to come'],
        ['bg-emerald-200', 'Photos'],
        ['bg-emerald-600', '20+ photos'],
        ['bg-red-600', 'Moment'],
        ['bg-gray-900 ring-2 ring-red-500', 'This week']
    ];
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
            {items.map(([classes, text]) => (
                <span key={text} className="inline-flex items-center gap-1.5">
                    <span className={`inline-block w-3 h-3 rounded-[3px] ${classes}`} />
                    {text}
                </span>
            ))}
        </div>
    );
}

function LifeCalendar() {
    // Hooks
    const search_params = useSearchParams();
    const router = useRouter();

    // State
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editing_settings, setEditingSettings] = useState(false);
    const [hover, setHover] = useState(null);
    const [focused, setFocused] = useState(null);
    const [selected, setSelected] = useState(null);
    const [details_version, setDetailsVersion] = useState(0);
    const [banner, setBanner] = useState('');

    // Refs
    const cache_ref = useRef(new Map());
    const inflight_ref = useRef(new Map());
    const hover_timer_ref = useRef(null);

    // Variables
    const calendar = data?.calendar;
    const birth_date = calendar?.birth_date;

    const current = useMemo(() => (birth_date ? weekOf(birth_date, todayString()) : null), [birth_date]);

    const summary = useMemo(() => {
        const map = new Map();
        if (!birth_date) return map;
        const add = (day, field, count) => {
            const position = weekOf(birth_date, day);
            if (!position) return;
            const key = weekKey(position.year, position.week);
            const entry = map.get(key) || { photos: 0, events: 0 };
            entry[field] += count;
            map.set(key, entry);
        };
        data.photo_days.forEach((row) => add(row.day, 'photos', row.count));
        data.event_days.forEach((row) => add(row.day, 'events', row.count));
        return map;
    }, [data, birth_date]);

    const totals = useMemo(() => {
        if (!calendar || !current) return null;
        const total = calendar.lifespan_years * WEEKS_PER_YEAR;
        const lived = current.year * WEEKS_PER_YEAR + current.week;
        const photos = data.photo_days.reduce((sum, row) => sum + row.count, 0);
        const moments = data.event_days.reduce((sum, row) => sum + row.count, 0);
        return { total, lived, left: Math.max(0, total - lived), percent: Math.min(100, Math.round((lived / total) * 100)), photos, moments };
    }, [calendar, current, data]);

    const years = Math.max(calendar?.lifespan_years || 0, current ? current.year + 1 : 0);

    // Callbacks
    const fetchData = useCallback(async () => {
        try {
            setData(await api('/api/life'));
        } catch (error) {
            console.error('Failed to load life calendar:', { error: error.message });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadWeek = useCallback(async ({ year, week }) => {
        const key = weekKey(year, week);
        const cached = cache_ref.current.get(key);
        if (cached && Date.now() - cached.fetched_at < DETAILS_TTL_MS) return cached.details;
        if (inflight_ref.current.has(key)) return inflight_ref.current.get(key);
        const promise = api(`/api/life/weeks/${year}/${week}`)
            .then((details) => {
                cache_ref.current.set(key, { details, fetched_at: Date.now() });
                setDetailsVersion((version) => version + 1);
                return details;
            })
            .finally(() => inflight_ref.current.delete(key));
        inflight_ref.current.set(key, promise);
        return promise;
    }, []);

    const cachedDetails = useCallback((position) => {
        if (!position) return null;
        return cache_ref.current.get(weekKey(position.year, position.week))?.details || null;
    }, []);

    const handleHover = useCallback((cell) => {
        setHover(cell);
        clearTimeout(hover_timer_ref.current);
        const entry = summary.get(weekKey(cell.year, cell.week));
        if (entry && entry.photos + entry.events > 0) {
            hover_timer_ref.current = setTimeout(() => loadWeek(cell).catch(() => {}), 120);
        }
    }, [summary, loadWeek]);

    const handleLeave = useCallback(() => {
        clearTimeout(hover_timer_ref.current);
        setHover(null);
    }, []);

    const handleSelect = useCallback((position) => {
        setHover(null);
        setFocused(position);
        setSelected(position);
        loadWeek(position).catch((error) => console.error('Failed to load week:', { error: error.message }));
    }, [loadWeek]);

    const handleNavigate = useCallback((delta) => {
        if (!selected) return;
        const index = Math.max(0, Math.min(years * WEEKS_PER_YEAR - 1, selected.year * WEEKS_PER_YEAR + selected.week + delta));
        const next = { year: Math.floor(index / WEEKS_PER_YEAR), week: index % WEEKS_PER_YEAR };
        setSelected(next);
        setFocused(next);
        loadWeek(next).catch(() => {});
    }, [selected, years, loadWeek]);

    const handleChanged = useCallback(async () => {
        cache_ref.current.clear();
        await fetchData();
        if (selected) loadWeek(selected).catch(() => {});
    }, [fetchData, selected, loadWeek]);

    // Effects
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const status = search_params.get('google');
        if (status) {
            setBanner(GOOGLE_MESSAGES[status] || '');
            router.replace('/');
        }
    }, [search_params, router]);

    // Render
    if (loading) {
        return <div className="text-center text-xl text-gray-500 mt-20">Loading...</div>;
    }

    if (!data) {
        return <div className="text-center text-gray-500 mt-20">Could not load your life calendar.</div>;
    }

    if (!calendar || editing_settings) {
        if (!data.can_edit) {
            return <p className="text-center text-gray-500 mt-20">The life calendar hasn’t been set up yet.</p>;
        }
        return (
            <SetupForm
                initial={calendar}
                on_cancel={calendar ? () => setEditingSettings(false) : null}
                on_saved={() => {
                    setEditingSettings(false);
                    cache_ref.current.clear();
                    fetchData();
                }}
            />
        );
    }

    // details_version forces a re-read of the cache after fetches land.
    void details_version;
    const hover_details = cachedDetails(hover);
    const selected_details = cachedDetails(selected);

    return (
        <div className="space-y-5">
            {banner && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-3 text-sm flex justify-between gap-4">
                    <span>{banner}</span>
                    <button onClick={() => setBanner('')} className="text-blue-500" aria-label="Dismiss">✕</button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your life so far</h2>
                    {totals && (
                        <p className="text-gray-500 mt-1">
                            <strong className="text-gray-900">{totals.lived.toLocaleString()}</strong> weeks lived ·{' '}
                            <strong className="text-gray-900">{totals.left.toLocaleString()}</strong> to go ({totals.percent}%) ·{' '}
                            {totals.moments} moments · {totals.photos.toLocaleString()} photos
                            {data.can_edit && (
                                <button onClick={() => setEditingSettings(true)} className="ml-2 text-sm text-gray-400 hover:text-gray-600 underline">
                                    Edit
                                </button>
                            )}
                        </p>
                    )}
                </div>
                <GooglePhotosImport
                    google={data.google}
                    can_edit={data.can_edit}
                    on_imported={handleChanged}
                    on_disconnected={fetchData}
                />
            </div>

            <Legend />

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-2 sm:p-4">
                <LifeGrid
                    years={years}
                    summary={summary}
                    current={current}
                    focused={focused}
                    on_hover={handleHover}
                    on_leave={handleLeave}
                    on_select={handleSelect}
                    on_focus_change={setFocused}
                />
            </div>

            <p className="text-xs text-gray-400 text-center">
                Hover over a week to peek, click to open it{data.can_edit ? ' and add your own moments' : ''}.
            </p>

            {hover && !selected && (
                <WeekPreview
                    anchor={hover.element}
                    label={weekLabel(birth_date, hover)}
                    entry={summary.get(weekKey(hover.year, hover.week))}
                    details={hover_details}
                />
            )}

            {selected && (
                <WeekPanel
                    label={weekLabel(birth_date, selected)}
                    range={{ ...weekRange(birth_date, selected.year, selected.week), last: weekLastDay(birth_date, selected.year, selected.week) }}
                    details={selected_details}
                    can_edit={data.can_edit}
                    on_close={() => setSelected(null)}
                    on_navigate={handleNavigate}
                    on_changed={handleChanged}
                />
            )}
        </div>
    );
}

export default function HomePage() {
    return (
        <Layout>
            <Suspense fallback={<div className="text-center text-xl text-gray-500 mt-20">Loading...</div>}>
                <LifeCalendar />
            </Suspense>
        </Layout>
    );
}
