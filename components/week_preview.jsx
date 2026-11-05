'use client';

// Floating card shown while hovering a week on devices with a mouse.
export default function WeekPreview({ anchor, label, entry, details }) {
    if (!anchor) return null;

    const rect = anchor.getBoundingClientRect();
    const width = 288;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = rect.top < 260;
    const style = below
        ? { left, top: rect.bottom + 10, width }
        : { left, bottom: window.innerHeight - rect.top + 10, width };

    const has_content = (entry?.photos || 0) + (entry?.events || 0) > 0;
    const photos = details?.photos || [];
    const events = details?.events || [];

    return (
        <div
            className="fixed z-40 pointer-events-none bg-white rounded-xl shadow-xl border border-gray-200 p-3 hidden [@media(hover:hover)]:block"
            style={style}
        >
            <div className="text-sm font-bold text-gray-900">{label.title}</div>
            <div className="text-xs text-gray-500">{label.subtitle}</div>

            {has_content && !details && <div className="text-xs text-gray-400 mt-2">Loading…</div>}

            {events.length > 0 && (
                <ul className="mt-2 space-y-1">
                    {events.slice(0, 4).map((event) => (
                        <li key={event.id} className="text-sm text-gray-800 truncate">
                            <span className="mr-1">{event.emoji || '•'}</span>{event.title}
                        </li>
                    ))}
                    {events.length > 4 && <li className="text-xs text-gray-400">+{events.length - 4} more</li>}
                </ul>
            )}

            {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-1 mt-2">
                    {photos.slice(0, 6).map((photo, index) => (
                        <div key={photo.id} className="relative aspect-square rounded-md overflow-hidden bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                            {index === 5 && photos.length > 6 && (
                                <div className="absolute inset-0 bg-black/50 text-white text-sm font-bold flex items-center justify-center">
                                    +{photos.length - 5}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!has_content && <div className="text-xs text-gray-400 mt-2">Nothing here yet. Click to add a memory.</div>}
            {has_content && <div className="text-[11px] text-gray-400 mt-2">Click to open</div>}
        </div>
    );
}
