const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Checks the backend health endpoint.
 * GET /health/ — does not require authentication.
 *
 * Returns:
 *   { ok: true, components }     — backend is reachable and healthy
 *   { ok: false, reason, components? } — backend unreachable or unhealthy
 */
export async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_URL}/health/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.status === 'unhealthy') {
      return { ok: false, reason: 'unhealthy', components: data.components ?? {} };
    }

    return { ok: true, components: data.components ?? {} };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'unreachable' };
  }
}

export default { checkHealth };
