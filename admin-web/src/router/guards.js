export const APP_TITLE = '颐邻管理后台'

// 未登录时带上回跳地址，登录后回到原页面（含筛选条件与订单 id）
export function loginGuard(to, isLoggedIn) {
  if (to.path === '/login' || isLoggedIn) return true
  return to.fullPath && to.fullPath !== '/' ? { path: '/login', query: { redirect: to.fullPath } } : '/login'
}

export function pageTitle(to) {
  return to.meta?.title ? `${to.meta.title} · ${APP_TITLE}` : APP_TITLE
}
