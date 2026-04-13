import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    const hash = window.location.hash.slice(1); // strip leading '#'
    const params = new URLSearchParams(hash);

    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const ssoError = params.get('error');

    if (ssoError) {
      window.location.replace(`/login?sso_error=${encodeURIComponent(ssoError)}`);
      return;
    }

    if (!accessToken) {
      window.location.replace('/login?sso_error=No+token+returned+from+SSO');
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    // Hard redirect so AuthContext reinitialises from localStorage
    window.location.replace('/dashboard');
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#6b7280',
    }}>
      Completing sign-in…
    </div>
  );
}
