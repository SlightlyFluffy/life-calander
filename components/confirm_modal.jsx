'use client';
import { useCallback } from 'react';

export default function ConfirmModal({ title, message, confirm_label, cancel_label, on_confirm, on_cancel }) {
    // Handlers
    const handleBackdropClick = useCallback((event) => {
        if (event.target === event.currentTarget) {
            on_cancel();
        }
    }, [on_cancel]);

    // Render
    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-6 cursor-pointer"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-xl">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-base text-gray-500 mb-8 leading-relaxed">{message}</p>
                <div className="flex gap-4">
                    <button
                        onClick={on_cancel}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-lg py-3.5 rounded-lg transition-colors"
                    >
                        {cancel_label || 'Cancel'}
                    </button>
                    <button
                        onClick={on_confirm}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-3.5 rounded-lg transition-colors"
                    >
                        {confirm_label || 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}
