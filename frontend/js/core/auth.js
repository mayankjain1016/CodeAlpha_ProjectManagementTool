/**
 * TaskFlow Authentication State Module
 */

const TOKEN_KEY = 'taskflow_token';
const USER_KEY = 'taskflow_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}

/**
 * Ensures user is authenticated before page loads.
 * If not, redirects to /login with returnUrl parameter.
 */
export function requireAuth() {
  if (!isAuthenticated()) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    window.location.replace(`/login?returnUrl=${returnUrl}`);
    return false;
  }
  return true;
}

/**
 * Ensures user is a guest (not logged in) on login/register pages.
 * If logged in, redirects to /dashboard.
 */
export function requireGuest() {
  if (isAuthenticated()) {
    window.location.replace('/dashboard');
    return false;
  }
  return true;
}

export function logout() {
  clearSession();
  window.location.replace('/login');
}
