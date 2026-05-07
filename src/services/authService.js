// Authentication service layer
// Wraps login/logout/refresh functionality with support for mock and real API

import * as mockAuthService from '../api/authService.js';
import { apiPost } from './apiClient.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

/**
 * Maps backend is_staff boolean to role string
 * @param {boolean} isStaff - User is_staff flag from backend
 * @returns {string} 'PROFESSOR' or 'STUDENT'
 */
function mapRoleFromBackend(isStaff) {
  return isStaff ? 'PROFESSOR' : 'STUDENT';
}

/**
 * Normalizes user data from either mock or real API
 * Mock format: { firstName, lastName, nia, email, role, subjects }
 * Backend format: { id, email, first_name, last_name, is_staff, organization, nia }
 * @param {object} user - User data from login response
 * @returns {object} Normalized user object
 */
function normalizeUser(user) {
  // Already in mock format (has role field)?
  if (user.role) {
    return user;
  }

  // Backend format — normalize to match frontend expectations
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    nia: user.nia || '',
    email: user.email,
    organization: user.organization,
    isStaff: user.is_staff,
    role: mapRoleFromBackend(user.is_staff),
    // subjects will be fetched separately via userService
    subjects: user.subjects || [],
  };
}

/**
 * Logs in a user with email and password
 * In mock mode: uses existing mockAuthService
 * In real mode: calls POST /auth/login/
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, token_refresh: string, user: object }>}
 */
export async function login(email, password) {
  if (USE_MOCK) {
    // Use existing mock auth service
    const result = await mockAuthService.login(email, password);
    return {
      token: result.token,
      token_refresh: result.token_refresh,
      user: normalizeUser(result.user),
    };
  }

  // Real API call — backend returns { access, refresh, user } per API contract
  const data = await apiPost('/auth/login/', { email, password });
  return {
    token: data.access,
    token_refresh: data.refresh,
    user: normalizeUser(data.user),
  };
}

/**
 * Refreshes the access token using a refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{ access: string, refresh: string }>}
 */
export async function refreshToken(refreshToken) {
  if (USE_MOCK) {
    const payload = btoa(
      JSON.stringify({ sub: 'mock', exp: Date.now() + 86400000 })
    );
    return {
      access: `mock.${payload}.signature`,
      refresh: `mock.${payload}.refresh`,
    };
  }

  // Backend expects { refresh } and returns { access, refresh } per API contract
  return apiPost('/auth/refresh/', { refresh: refreshToken });
}

/**
 * Logs out a user by revoking their refresh token
 * @param {string} refreshToken - Refresh token to revoke
 * @returns {Promise<void>}
 */
export async function logout(refreshToken) {
  if (USE_MOCK) {
    // Mock mode: no-op
    return Promise.resolve();
  }

  // Backend expects { refresh } per API contract
  try {
    await apiPost('/auth/logout/', { refresh: refreshToken });
  } catch (error) {
    console.warn('Logout API call failed:', error);
  }
}

/**
 * Returns Authorization header with current token
 * @returns {object} Header object or empty object if no token
 */
export function getAuthHeaders() {
  if (USE_MOCK) {
    return mockAuthService.getAuthHeaders();
  }

  const token = localStorage.getItem('scde_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default {
  login,
  logout,
  refreshToken,
  getAuthHeaders,
};
