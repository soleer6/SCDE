// User management service layer
// Handles CRUD operations on users with mock fallback support

import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient.js';
import * as mockData from '../api/mockData.js';

const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

/**
 * Generates mock users from the existing mock data
 * Returns all users with mock IDs (numbers)
 * @returns {Array<object>}
 */
function getMockUsers() {
  // In a real implementation, mockData might have MOCK_USERS
  // For now, return empty array since users aren't in mockData yet
  return [];
}

/**
 * Normalizes user data from backend format to frontend format
 * @param {object} user - User from API response
 * @returns {object} Normalized user
 */
function normalizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    nia: user.nia || '',
    isActive: user.is_active,
    isStaff: user.is_staff,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

/**
 * Normalizes a paginated list response
 * @param {object} response - API response with count, page, page_size, results
 * @returns {object} Normalized pagination response
 */
function normalizePaginatedResponse(response) {
  return {
    count: response.count,
    page: response.page,
    pageSize: response.page_size,
    totalPages: response.total_pages,
    next: response.next,
    previous: response.previous,
    results: response.results.map(normalizeUser),
  };
}

/**
 * Retrieves a paginated list of users in the organization
 * Requires PROFESSOR or SUPERADMIN role
 * @param {object} params - Query parameters { page, page_size, search, is_active }
 * @returns {Promise<object>} Paginated user list
 */
export async function getUsers(params = {}) {
  if (USE_MOCK) {
    const mockUsers = getMockUsers();
    return {
      count: mockUsers.length,
      page: params.page || 1,
      pageSize: params.page_size || 25,
      totalPages: Math.ceil(mockUsers.length / (params.page_size || 25)),
      next: null,
      previous: null,
      results: mockUsers,
    };
  }

  // Build query string from params
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append('page', params.page);
  if (params.page_size) queryParams.append('page_size', params.page_size);
  if (params.search) queryParams.append('search', params.search);
  if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);

  const queryString = queryParams.toString();
  const endpoint = `/users/${queryString ? '?' + queryString : ''}`;

  const data = await apiGet(endpoint);
  return normalizePaginatedResponse(data);
}

/**
 * Retrieves a specific user by ID
 * @param {string} userId - UUID string from backend or number from mock
 * @returns {Promise<object>} User object
 */
export async function getUser(userId) {
  if (USE_MOCK) {
    // Not implemented in mock
    return null;
  }

  const data = await apiGet(`/users/${userId}/`);
  return normalizeUser(data);
}

/**
 * Creates a new user in the organization
 * Requires PROFESSOR or SUPERADMIN role
 * @param {object} userData - User data { email, first_name, last_name, password, nia, is_staff, email_notifications_enabled }
 * @returns {Promise<object>} Created user
 */
export async function createUser(userData) {
  if (USE_MOCK) {
    // Not implemented in mock
    throw new Error('Create user not available in mock mode');
  }

  const data = await apiPost('/users/', userData);
  return normalizeUser(data);
}

/**
 * Updates a user
 * @param {string} userId - UUID or number
 * @param {object} updates - Partial user data to update
 * @returns {Promise<object>} Updated user
 */
export async function updateUser(userId, updates) {
  if (USE_MOCK) {
    // Not implemented in mock
    throw new Error('Update user not available in mock mode');
  }

  const data = await apiPatch(`/users/${userId}/`, updates);
  return normalizeUser(data);
}

/**
 * Soft-deletes a user (sets is_active to False)
 * @param {string} userId - UUID or number
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  if (USE_MOCK) {
    // Not implemented in mock
    throw new Error('Delete user not available in mock mode');
  }

  await apiDelete(`/users/${userId}/`);
}

/**
 * Changes a user's password
 * @param {string} userId - UUID or number
 * @param {object} passwordData - { current_password, new_password } or just { new_password } if SUPERADMIN
 * @returns {Promise<void>}
 */
export async function changePassword(userId, passwordData) {
  if (USE_MOCK) {
    // Not implemented in mock
    throw new Error('Change password not available in mock mode');
  }

  await apiPost(`/users/${userId}/change-password/`, passwordData);
}

export default {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};
