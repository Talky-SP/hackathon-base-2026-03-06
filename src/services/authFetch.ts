import { fetchAuthSession, signOut } from 'aws-amplify/auth';

export async function getCognitoToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ??
           session.tokens?.accessToken?.toString() ??
           null;
  } catch {
    return null;
  }
}

export async function authenticatedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getCognitoToken();
  if (!token) {
    window.location.href = '/auth';
    throw new Error('Unauthenticated');
  }

  const headers = new Headers(init.headers || {});
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let response = await fetch(url, { ...init, headers });

  if (response.status === 401) {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const fresh = session.tokens?.idToken?.toString() ??
                    session.tokens?.accessToken?.toString();
      if (fresh) {
        headers.set('Authorization', `Bearer ${fresh}`);
        response = await fetch(url, { ...init, headers });
      }
    } catch { /* refresh failed */ }

    if (response.status === 401) {
      try { await signOut(); } catch { /* ignore */ }
      window.location.href = '/auth';
      throw new Error('Unauthenticated');
    }
  }

  if (response.status === 403) {
    throw new Error('Forbidden');
  }

  return response;
}
