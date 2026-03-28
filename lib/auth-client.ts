'use client';

export function clearAuthState(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshResponse = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!refreshResponse.ok) {
      clearAuthState();
      return false;
    }

    const data = await refreshResponse.json();
    if (!data?.token || typeof data.token !== 'string') {
      clearAuthState();
      return false;
    }

    localStorage.setItem('token', data.token);
    return true;
  } catch {
    clearAuthState();
    return false;
  }
}

function getAuthHeaders(headers: HeadersInit | undefined, token: string | null): Headers {
  const nextHeaders = new Headers(headers);
  if (token) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = localStorage.getItem('token');

  const initialResponse = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: getAuthHeaders(init.headers, token),
  });

  if (initialResponse.status !== 401) {
    return initialResponse;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return initialResponse;
  }

  const refreshedToken = localStorage.getItem('token');
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers: getAuthHeaders(init.headers, refreshedToken),
  });
}
