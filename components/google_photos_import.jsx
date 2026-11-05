'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import api from '@/lib/api.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Opens the Google Photos Picker in a popup, waits for the user to finish
// choosing, then imports the chosen items page by page.
export default function GooglePhotosImport({ google, can_edit, on_imported, on_disconnected }) {
    // State
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const cancelled_ref = useRef(false);

    // Effects
    useEffect(() => () => { cancelled_ref.current = true; }, []);

    // Handlers
    const handleImport = useCallback(async () => {
        // Open the window synchronously so the browser doesn't block the popup.
        const popup = window.open('', 'google-photos-picker', 'width=1000,height=760');
        cancelled_ref.current = false;
        setStatus('picking');
        setMessage('Choose photos in the Google Photos window, then press Done.');

        let session;
        try {
            session = await api('/api/google/picker', { method: 'POST' });
            if (popup) popup.location.href = session.picker_uri;
            else window.open(session.picker_uri, '_blank');

            const deadline = Date.now() + session.timeout_ms;
            let ready = false;
            while (!ready && !cancelled_ref.current && Date.now() < deadline) {
                await sleep(session.poll_interval_ms);
                ({ media_items_set: ready } = await api(`/api/google/picker/${session.id}`));
            }
            if (!ready) {
                setStatus('idle');
                setMessage(cancelled_ref.current ? '' : 'The picker timed out. Try again.');
                return;
            }

            setStatus('importing');
            const time_zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const totals = { imported: 0, skipped: 0, over_cap: 0, before_birth: 0, failed: 0 };
            let page_token = null;
            do {
                const result = await api(`/api/google/picker/${session.id}/import`, {
                    method: 'POST',
                    body: { page_token, time_zone }
                });
                totals.imported += result.imported;
                totals.skipped += result.skipped;
                totals.over_cap += result.over_cap;
                totals.before_birth += result.before_birth;
                totals.failed += result.failed;
                page_token = result.next_page_token;
                setMessage(`Imported ${totals.imported} so far…`);
            } while (page_token && !cancelled_ref.current);

            const parts = [`Imported ${totals.imported} photo${totals.imported === 1 ? '' : 's'}`];
            if (totals.skipped) parts.push(`${totals.skipped} already here`);
            if (totals.over_cap) parts.push(`${totals.over_cap} skipped (that week already has 10)`);
            if (totals.before_birth) parts.push(`${totals.before_birth} from before your birth date`);
            if (totals.failed) parts.push(`${totals.failed} failed`);
            setMessage(`${parts.join(', ')}.`);
            setStatus('idle');
            on_imported();
        } catch (error) {
            popup?.close();
            setStatus('idle');
            setMessage(error.message);
        } finally {
            if (session) {
                api(`/api/google/picker/${session.id}`, { method: 'DELETE' }).catch(() => {});
            }
        }
    }, [on_imported]);

    const handleCancel = useCallback(() => {
        cancelled_ref.current = true;
    }, []);

    const handleDisconnect = useCallback(async () => {
        if (!confirm('Disconnect Google Photos? Photos already imported stay in your calendar. You can reconnect any time.')) return;
        await api('/api/google', { method: 'DELETE' });
        on_disconnected();
    }, [on_disconnected]);

    // Render
    if (!can_edit) return null;

    if (!google.configured) {
        return (
            <p className="text-sm text-gray-500">
                Google Photos is not set up on this server yet (see README: <code>GOOGLE_CLIENT_ID</code>).
            </p>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            {!google.connected ? (
                <a
                    href="/api/auth/google?consent=1"
                    className="inline-flex items-center justify-center gap-2 bg-white border-2 border-gray-200 hover:border-gray-300 rounded-lg px-4 py-2 font-semibold text-gray-800"
                >
                    <span>📷</span> Connect Google Photos
                </a>
            ) : (
                <>
                    {status === 'idle' ? (
                        <button
                            onClick={handleImport}
                            className="inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white rounded-lg px-4 py-2 font-semibold"
                        >
                            <span>📷</span> Import from Google Photos
                        </button>
                    ) : (
                        <button
                            onClick={handleCancel}
                            className="inline-flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg px-4 py-2 font-semibold"
                        >
                            Cancel import
                        </button>
                    )}
                    {status === 'idle' && (
                        <button onClick={handleDisconnect} className="text-sm text-gray-400 hover:text-gray-600">
                            Disconnect
                        </button>
                    )}
                </>
            )}
            {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
    );
}
