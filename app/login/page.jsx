const ERRORS = {
    cancelled: 'Sign-in was cancelled.',
    invalid: 'That sign-in link expired. Please try again.',
    error: 'Something went wrong signing in. Please try again.',
    not_configured: 'Google sign-in is not set up on this server yet (GOOGLE_CLIENT_ID).'
};

export default async function LoginPage({ searchParams }) {
    const { error } = await searchParams;

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="bg-white border-2 border-gray-200 rounded-2xl p-8 max-w-sm w-full text-center">
                <div className="grid grid-cols-8 gap-1 w-32 mx-auto mb-6" aria-hidden="true">
                    {Array.from({ length: 32 }, (_, index) => (
                        <div
                            key={index}
                            className={`aspect-square rounded-[3px] ${index < 19 ? 'bg-gray-300' : index === 19 ? 'bg-gray-900 ring-2 ring-red-500' : 'border border-gray-200'} ${[4, 11, 15].includes(index) ? '!bg-emerald-400' : ''} ${index === 8 ? '!bg-red-600' : ''}`}
                        />
                    ))}
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Life in Weeks</h1>
                <p className="text-gray-500 mt-2 mb-8">
                    Your life, one box per week. Fill it with your Google Photos and the moments that mattered.
                </p>
                {error && <p className="text-sm text-red-600 mb-4">{ERRORS[error] || ERRORS.error}</p>}
                <a
                    href="/api/auth/google"
                    className="flex items-center justify-center gap-3 w-full bg-white border-2 border-gray-300 hover:border-gray-400 rounded-lg py-3 font-semibold text-gray-800"
                >
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
                        <path fill="#FBBC05" d="M10.5 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.6 10.7l7.9-6.2z" />
                        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
                    </svg>
                    Sign in with Google
                </a>
                <p className="text-xs text-gray-400 mt-4">
                    You choose which photos to share. Nothing is changed in your Google Photos.
                </p>
            </div>
        </div>
    );
}
