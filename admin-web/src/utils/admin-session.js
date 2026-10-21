export function hasAdminSession(storage) {
  try {
    if (storage.getItem('admin_token') && JSON.parse(storage.getItem('admin_user') || '{}').role === 'ADMIN') return true
  } catch { /* malformed cached session */ }
  storage.removeItem('admin_token')
  storage.removeItem('admin_user')
  return false
}
