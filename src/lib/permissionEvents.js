// Invalidation only; permission data is never persisted in localStorage.
let revision = 0;
const listeners = new Set();
export const permissionRevision = () => revision;
export const subscribePermissions = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function invalidatePermissions() {
  revision += 1;
  listeners.forEach((listener) => listener());
}
