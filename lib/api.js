// Small fetch wrapper for the browser: JSON in/out, FormData passthrough,
// and a redirect to the sign-in page when the session has expired.
export const api = async (path, options = {}) => {
    const init = {
        credentials: 'include',
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) }
    };
    if (init.body instanceof FormData) {
        delete init.headers['content-type'];
    } else if (init.body && typeof init.body !== 'string') {
        init.body = JSON.stringify(init.body);
    }
    const response = await fetch(path, init);
    if (response.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
    }
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        throw new Error(data?.error || `Request failed: ${response.status}`);
    }
    return data;
};

export default api;
