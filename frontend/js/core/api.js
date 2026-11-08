/**
 * TaskFlow API Client
 * Wraps native fetch with auth headers, error parsing, and relative URLs.
 */

import { getToken, logout } from './auth.js';

class ApiClient {
  async request(endpoint, options = {}) {
    let url = endpoint;
    if (!url.startsWith('/api')) {
      url = url.startsWith('/') ? `/api${url}` : `/api/${url}`;
    }
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const res = await fetch(url, config);

      if (res.status === 401) {
        // If not already on login/register, clear session and redirect
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          logout();
          return;
        }
      }

      let data;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        const error = new Error((data && data.message) || res.statusText || 'Request failed');
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // Re-throw for caller to handle
      throw err;
    }
  }

  get(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
