// Mock users database for development (VITE_MOCK_API=true)
const MOCK_USERS = [
    {
        email: 'maria.perez@uni.es',
        password: 'prof123',
        user: {
            firstName: 'María',
            lastName: 'Pérez García',
            nia: 'P001',
            email: 'maria.perez@uni.es',
            role: 'PROFESSOR',
            subjects: [
                { code: 'MAT101', year: '2024-25', name: 'Matemáticas I', semester: '1' },
                { code: 'FIS101', year: '2024-25', name: 'Física I', semester: '1' },
            ],
        },
    },
    {
        email: 'juan.torres@uni.es',
        password: 'prof123',
        user: {
            firstName: 'Juan',
            lastName: 'Torres Martínez',
            nia: 'P002',
            email: 'juan.torres@uni.es',
            role: 'PROFESSOR',
            subjects: [
                { code: 'MAT101', year: '2024-25', name: 'Matemáticas I', semester: '1' },
            ],
        },
    },
    {
        email: 'elena.r@estudiante.uni.es',
        password: 'est123',
        user: {
            firstName: 'Elena',
            lastName: 'Rodríguez López',
            nia: 'A001',
            email: 'elena.r@estudiante.uni.es',
            role: 'STUDENT',
            subjects: [
                { code: 'MAT101', year: '2024-25', name: 'Matemáticas I', semester: '1' },
                { code: 'FIS101', year: '2024-25', name: 'Física I', semester: '1' },
            ],
        },
    },
    {
        email: 'pablo.f@estudiante.uni.es',
        password: 'est123',
        user: {
            firstName: 'Pablo',
            lastName: 'Fernández Sanz',
            nia: 'A002',
            email: 'pablo.f@estudiante.uni.es',
            role: 'STUDENT',
            subjects: [
                { code: 'MAT101', year: '2024-25', name: 'Matemáticas I', semester: '1' },
            ],
        },
    },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

// Simulates a network delay for mock mode
const delay = (ms = 600) => new Promise((res) => setTimeout(res, ms));

// Generates a fake JWT-like token for mock mode
function generateMockToken(email) {
    const payload = btoa(JSON.stringify({ sub: email, exp: Date.now() + 86400000 }));
    return `mock.${payload}.signature`;
}

/**
 * Authenticates the user.
 * In mock mode: validates against MOCK_USERS.
 * In real mode: POSTs to /auth/login and expects { token, token_refresh, user }.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ token: string, token_refresh: string, user: object }>}
 */
export async function login(email, password) {
    if (USE_MOCK) {
        await delay();
        const found = MOCK_USERS.find(
            (u) => u.email === email && u.password === password,
        );
        if (!found) {
            throw new Error('Credenciales incorrectas. Comprueba tu email y contraseña.');
        }
        return {
            token: generateMockToken(email),
            token_refresh: generateMockToken(email + '_refresh'),
            user: found.user,
        };
    }

    // Real API call
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || data.message || 'Error al iniciar sesión.');
    }

    return response.json();
}

/**
 * Returns default Authorization headers using the stored token.
 */
export function getAuthHeaders() {
    const token = localStorage.getItem('scde_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}
