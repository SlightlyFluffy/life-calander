'use client';
import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api.js';
import ConfirmModal from '@/components/confirm_modal.jsx';

const EMOJIS = ['🎉', '❤️', '🎓', '💼', '🏠', '✈️', '👶', '💍', '🏆', '🌱', '😢', '⭐'];

const inputClass = 'w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-base focus:border-red-400 focus:outline-none';

function EventForm({ initial, min, max, on_cancel, on_saved }) {
    // State
    const [title, setTitle] = useState(initial?.title || '');
    const [event_date, setEventDate] = useState(initial?.event_date || min);
    const [notes, setNotes] = useState(initial?.notes || '');
    const [emoji, setEmoji] = useState(initial?.emoji || '');
    const [image, setImage] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Handlers
    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            if (initial) {
                await api(`/api/life/events/${initial.id}`, { method: 'PUT', body: { title, event_date, notes, emoji } });
            } else {
                const form = new FormData();
                form.set('title', title);
                form.set('event_date', event_date);
                form.set('notes', notes);
                form.set('emoji', emoji);
                if (image) form.set('image', image);
                await api('/api/life/events', { method: 'POST', body: form });
            }
            on_saved();
        } catch (save_error) {
            setError(save_error.message);
        } finally {
            setSaving(false);
        }
    }, [initial, title, event_date, notes, emoji, image, on_saved]);

    // Render
    return (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl p-4 space-y-3">
            <input
                className={inputClass}
                placeholder="What happened? e.g. First day at school"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
                autoFocus
            />
            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="date"
                    className={`${inputClass} sm:w-48`}
                    value={event_date}
                    min={min}
                    max={max}
                    onChange={(event) => setEventDate(event.target.value)}
                    required
                />
                <div className="flex flex-wrap gap-1 items-center">
                    {EMOJIS.map((option) => (
                        <button
                            type="button"
                            key={option}
                            onClick={() => setEmoji(emoji === option ? '' : option)}
                            className={`w-9 h-9 rounded-lg text-lg ${emoji === option ? 'bg-red-100 ring-2 ring-red-400' : 'hover:bg-gray-200'}`}
                            aria-label={`Use ${option}`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
            <textarea
                className={inputClass}
                placeholder="Notes (optional)"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
            />
            {!initial && (
                <label className="block text-sm text-gray-600">
                    Add a photo (optional)
                    <input
                        type="file"
                        accept="image/*"
                        className="block mt-1 text-sm"
                        onChange={(event) => setImage(event.target.files?.[0] || null)}
                    />
                </label>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end">
                <button type="button" onClick={on_cancel} className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold">
                    Cancel
                </button>
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </form>
    );
}

export default function WeekPanel({ label, details, range, can_edit, on_close, on_navigate, on_changed }) {
    // State
    const [mode, setMode] = useState(null);
    const [lightbox, setLightbox] = useState(null);
    const [confirm, setConfirm] = useState(null);

    // Variables
    const events = details?.events || [];
    const photos = details?.photos || [];
    const editing = mode && mode !== 'new' ? events.find((event) => event.id === mode) : null;

    // Handlers
    const handleSaved = useCallback(() => {
        setMode(null);
        on_changed();
    }, [on_changed]);

    const handleDelete = useCallback(async () => {
        const target = confirm;
        setConfirm(null);
        try {
            await api(target.kind === 'event' ? `/api/life/events/${target.id}` : `/api/life/photos/${target.id}`, { method: 'DELETE' });
            setLightbox(null);
            on_changed();
        } catch (error) {
            alert(error.message);
        }
    }, [confirm, on_changed]);

    // Effects
    useEffect(() => {
        setMode(null);
        setLightbox(null);
    }, [range.start]);

    useEffect(() => {
        const handleKey = (event) => {
            if (event.target.closest?.('input, textarea')) return;
            if (event.key === 'Escape') {
                if (lightbox) setLightbox(null);
                else on_close();
            } else if (event.key === 'ArrowLeft' && !lightbox) on_navigate(-1);
            else if (event.key === 'ArrowRight' && !lightbox) on_navigate(1);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [lightbox, on_close, on_navigate]);

    // Render
    return (
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:px-6"
            onClick={(event) => event.target === event.currentTarget && on_close()}
        >
            <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3 z-10">
                    <button onClick={() => on_navigate(-1)} className="w-9 h-9 rounded-lg hover:bg-gray-100 text-xl" aria-label="Previous week">‹</button>
                    <div className="flex-1 text-center">
                        <div className="text-lg font-bold text-gray-900">{label.title}</div>
                        <div className="text-sm text-gray-500">{label.subtitle}</div>
                    </div>
                    <button onClick={() => on_navigate(1)} className="w-9 h-9 rounded-lg hover:bg-gray-100 text-xl" aria-label="Next week">›</button>
                    <button onClick={on_close} className="w-9 h-9 rounded-lg hover:bg-gray-100 text-xl text-gray-500" aria-label="Close">✕</button>
                </div>

                <div className="p-5 space-y-6">
                    {!details && <div className="text-center text-gray-400 py-10">Loading…</div>}

                    {details && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-bold text-gray-900">Moments</h3>
                                {can_edit && mode !== 'new' && (
                                    <button onClick={() => setMode('new')} className="text-sm font-semibold text-red-700 hover:text-red-800">
                                        + Add a moment
                                    </button>
                                )}
                            </div>
                            {mode === 'new' && (
                                <EventForm min={range.start} max={range.last} on_cancel={() => setMode(null)} on_saved={handleSaved} />
                            )}
                            {events.length === 0 && mode !== 'new' && (
                                <p className="text-gray-400 text-sm">No moments recorded for this week.</p>
                            )}
                            <ul className="space-y-3 mt-3">
                                {events.map((event) => (
                                    editing?.id === event.id ? (
                                        <li key={event.id}>
                                            <EventForm initial={event} min={range.start} max={range.last} on_cancel={() => setMode(null)} on_saved={handleSaved} />
                                        </li>
                                    ) : (
                                        <li key={event.id} className="border-2 border-gray-100 rounded-xl p-4 flex gap-3">
                                            <div className="text-2xl leading-none">{event.emoji || '📌'}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-gray-900">{event.title}</div>
                                                <div className="text-xs text-gray-400">{new Date(`${event.event_date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                                                {event.notes && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{event.notes}</p>}
                                                {event.image_url && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={event.image_url}
                                                        alt={event.title}
                                                        className="mt-3 rounded-lg max-h-64 object-cover cursor-zoom-in"
                                                        onClick={() => setLightbox({ url: event.image_url })}
                                                    />
                                                )}
                                            </div>
                                            {can_edit && (
                                                <div className="flex flex-col gap-1 text-sm">
                                                    <button onClick={() => setMode(event.id)} className="text-gray-500 hover:text-gray-800">Edit</button>
                                                    <button onClick={() => setConfirm({ kind: 'event', id: event.id })} className="text-red-500 hover:text-red-700">Delete</button>
                                                </div>
                                            )}
                                        </li>
                                    )
                                ))}
                            </ul>
                        </section>
                    )}

                    {details && (
                        <section>
                            <h3 className="font-bold text-gray-900 mb-3">
                                Photos {photos.length > 0 && <span className="text-gray-400 font-normal">({photos.length})</span>}
                            </h3>
                            {photos.length === 0 ? (
                                <p className="text-gray-400 text-sm">No photos from this week. Import some from Google Photos.</p>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                    {photos.map((photo) => (
                                        <button
                                            key={photo.id}
                                            onClick={() => setLightbox(photo)}
                                            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={photo.url} alt={photo.file_name || ''} className="w-full h-full object-cover" loading="lazy" />
                                            {photo.media_type === 'VIDEO' && (
                                                <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">▶ video</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>

            {lightbox && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lightbox.url} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                    <div className="mt-4 flex items-center gap-4 text-sm text-white/80" onClick={(event) => event.stopPropagation()}>
                        {lightbox.taken_at && <span>{new Date(lightbox.taken_at).toLocaleString()}</span>}
                        {lightbox.media_type === 'VIDEO' && <span>Still frame from a video in Google Photos</span>}
                        {can_edit && lightbox.id && (
                            <button onClick={() => setConfirm({ kind: 'photo', id: lightbox.id })} className="text-red-300 hover:text-red-200">
                                Remove from calendar
                            </button>
                        )}
                        <button onClick={() => setLightbox(null)} className="text-white hover:text-white/70">Close</button>
                    </div>
                </div>
            )}

            {confirm && (
                <div className="relative z-[70]">
                    <ConfirmModal
                        title={confirm.kind === 'event' ? 'Delete this moment?' : 'Remove this photo?'}
                        message={confirm.kind === 'event'
                            ? 'This moment will be permanently deleted.'
                            : 'The copy in your Little Red Book is removed. The original stays in Google Photos.'}
                        confirm_label={confirm.kind === 'event' ? 'Delete' : 'Remove'}
                        on_confirm={handleDelete}
                        on_cancel={() => setConfirm(null)}
                    />
                </div>
            )}
        </div>
    );
}
