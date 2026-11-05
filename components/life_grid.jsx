'use client';
import { memo, useCallback, useRef } from 'react';
import { WEEKS_PER_YEAR, weekKey } from '@/lib/life_weeks.js';

const cellClass = ({ is_current, is_past, photos, events }) => {
    if (is_current) return 'bg-gray-900 ring-2 ring-red-500 animate-pulse';
    if (events > 0) return 'bg-red-600';
    if (photos >= 20) return 'bg-emerald-600';
    if (photos >= 5) return 'bg-emerald-400';
    if (photos > 0) return 'bg-emerald-200';
    if (is_past) return 'bg-gray-300';
    return 'bg-white border border-gray-200';
};

const Row = memo(function Row({ year, summary, current, focused_week }) {
    const cells = [];
    for (let week = 0; week < WEEKS_PER_YEAR; week += 1) {
        const entry = summary.get(weekKey(year, week));
        const is_current = current && current.year === year && current.week === week;
        const is_past = !current || year < current.year || (year === current.year && week < current.week);
        cells.push(
            <div
                key={week}
                data-year={year}
                data-week={week}
                className={`aspect-square rounded-[2px] sm:rounded-[3px] transition-transform hover:scale-150 hover:z-10 hover:shadow ${cellClass({
                    is_current, is_past, photos: entry?.photos || 0, events: entry?.events || 0
                })} ${focused_week === week ? 'outline-2 outline-offset-1 outline-blue-500 z-10' : ''}`}
            />
        );
    }
    return (
        <div className={`flex items-center gap-1 sm:gap-2 ${year > 0 && year % 10 === 0 ? 'mt-1.5 sm:mt-2.5' : ''}`}>
            <div className="w-5 sm:w-7 shrink-0 text-right text-[9px] sm:text-[11px] text-gray-400 tabular-nums leading-none">
                {year % 5 === 0 ? year : ''}
            </div>
            <div className="grid flex-1 gap-[1px] sm:gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS_PER_YEAR}, minmax(0, 1fr))` }}>
                {cells}
            </div>
        </div>
    );
});

// Renders every week of a life. Uses one set of delegated handlers instead of
// thousands of per-cell listeners, and arrow keys move a single focus cursor.
export default function LifeGrid({ years, summary, current, focused, on_hover, on_leave, on_select, on_focus_change }) {
    const container_ref = useRef(null);

    const cellFromEvent = (event) => {
        const target = event.target.closest?.('[data-week]');
        if (!target) return null;
        return { year: Number(target.dataset.year), week: Number(target.dataset.week), element: target };
    };

    const handleMouseOver = useCallback((event) => {
        const cell = cellFromEvent(event);
        if (cell) on_hover(cell);
    }, [on_hover]);

    const handleClick = useCallback((event) => {
        const cell = cellFromEvent(event);
        if (cell) on_select({ year: cell.year, week: cell.week });
    }, [on_select]);

    const handleKeyDown = useCallback((event) => {
        const position = focused || current || { year: 0, week: 0 };
        const moves = {
            ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0]
        };
        if (moves[event.key]) {
            event.preventDefault();
            const [dy, dw] = moves[event.key];
            let year = position.year + dy;
            let week = position.week + dw;
            if (week < 0) { week = WEEKS_PER_YEAR - 1; year -= 1; }
            if (week >= WEEKS_PER_YEAR) { week = 0; year += 1; }
            year = Math.max(0, Math.min(years - 1, year));
            on_focus_change({ year, week });
            const element = container_ref.current?.querySelector(`[data-year="${year}"][data-week="${week}"]`);
            if (element) {
                element.scrollIntoView({ block: 'nearest' });
                on_hover({ year, week, element });
            }
        } else if ((event.key === 'Enter' || event.key === ' ') && focused) {
            event.preventDefault();
            on_select(focused);
        }
    }, [focused, current, years, on_focus_change, on_hover, on_select]);

    const rows = [];
    for (let year = 0; year < years; year += 1) {
        rows.push(
            <Row
                key={year}
                year={year}
                summary={summary}
                current={current}
                focused_week={focused?.year === year ? focused.week : -1}
            />
        );
    }

    return (
        <div
            ref={container_ref}
            role="grid"
            tabIndex={0}
            aria-label="Life calendar. Use arrow keys to move between weeks and Enter to open one."
            className="flex flex-col gap-[1px] sm:gap-[3px] cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded-lg p-1"
            onMouseOver={handleMouseOver}
            onMouseLeave={on_leave}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onFocus={() => !focused && current && on_focus_change(current)}
        >
            <div className="flex items-center gap-1 sm:gap-2 mb-1">
                <div className="w-5 sm:w-7 shrink-0" />
                <div className="flex-1 flex justify-between text-[9px] sm:text-[11px] text-gray-400">
                    <span>Week 1</span><span>26</span><span>52</span>
                </div>
            </div>
            {rows}
        </div>
    );
}
