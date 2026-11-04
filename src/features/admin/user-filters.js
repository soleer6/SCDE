// Shared criteria for list and full export. Pagination/format never enter here.
export const USER_FILTER_KEYS = ['search', 'is_active', 'is_staff', 'nia', 'email'];
export function userFilters(values = {}) {
  return Object.fromEntries(USER_FILTER_KEYS.flatMap(key => {
    let value = values[key] == null ? '' : String(values[key]).trim();
    if (['is_active', 'is_staff'].includes(key) && ['true', 'false'].includes(value.toLowerCase())) value = value.toLowerCase();
    return value ? [[key, value]] : [];
  }));
}
