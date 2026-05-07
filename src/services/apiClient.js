// Base API client with JWT interceptors and auto-refresh logic
// Supports both mock mode (VITE_MOCK_API=true) and real API calls

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE = `${API_URL}/api/v1`;
const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

/**
 * Extracts error code from API response body or returns a default
 * @param {Response} response - Fetch response object
 * @param {object} data - Parsed JSON response body
 * @returns {string} Error code
 */
function extractErrorCode(response, data) {
  if (data && data.error_code) {
    return data.error_code;
  }
  switch (response.status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    default:
      return 'INTERNAL_ERROR';
  }
}

/**
 * Attempts to refresh the access token using the refresh token
 * @returns {Promise<{access: string, refresh: string} | null>}
 */
async function attemptTokenRefresh() {
  const refreshToken = localStorage.getItem('scde_token_refresh');
  if (!refreshToken) {
    return null;
  }

  try {
    // Backend expects { refresh } and returns { access, refresh } per API contract
    const response = await fetch(`${API_BASE}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      localStorage.removeItem('scde_token');
      localStorage.removeItem('scde_token_refresh');
      localStorage.removeItem('scde_user');
      window.location.href = '/login';
      return null;
    }

    const data = await response.json();
    localStorage.setItem('scde_token', data.access);
    localStorage.setItem('scde_token_refresh', data.refresh);
    return data;
  } catch (error) {
    // Network error during refresh, clear and redirect
    localStorage.removeItem('scde_token');
    localStorage.removeItem('scde_token_refresh');
    localStorage.removeItem('scde_user');
    window.location.href = '/login';
    return null;
  }
}

/**
 * Main API request function with JWT authorization and auto-refresh
 * @param {string} endpoint - API endpoint (without base URL), e.g., '/users/'
 * @param {object} options - Fetch options { method, body, headers, ... }
 * @returns {Promise<object>} Parsed response body
 * @throws {Error} With errorCode property
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('scde_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized — attempt refresh
  if (response.status === 401) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry original request with new token
      const newToken = localStorage.getItem('scde_token');
      const retryHeaders = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      if (newToken) {
        retryHeaders.Authorization = `Bearer ${newToken}`;
      }

      response = await fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  // Parse response
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(extractErrorCode(response, data));
    error.errorCode = extractErrorCode(response, data);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * GET request helper
 */
export function apiGet(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, method: 'GET' });
}

/**
 * POST request helper
 */
export function apiPost(endpoint, body = null, options = {}) {
  return apiRequest(endpoint, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * PATCH request helper
 */
export function apiPatch(endpoint, body = null, options = {}) {
  return apiRequest(endpoint, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * DELETE request helper
 */
export function apiDelete(endpoint, options = {}) {
  return apiRequest(endpoint, { ...options, method: 'DELETE' });
}

export default {
  apiRequest,
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  API_BASE,
  USE_MOCK,
};
