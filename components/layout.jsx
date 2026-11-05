'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api.js';

export default function Layout({ children }) {
    // State
    const [user, setUser] = useState(null);

    // Effects
    useEffect(() => {
        api('/api/auth/me').then(({ user: current }) => setUser(current)).catch(() => {});
    }, []);

    // Handlers
    const handleLogout = async () => {
        await api('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    };

    // Render
    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900">🗓️ Life in Weeks</h1>
                    {user && (
                        <div className="flex items-center gap-3">
                            {user.picture && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={user.picture} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                            )}
                            <span className="hidden sm:inline text-sm text-gray-600">{user.name || user.email}</span>
                            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700">
                                Sign out
                            </button>
                        </div>
                    )}
                </div>
            </header>
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                {children}
            </main>
        </div>
    );
}
