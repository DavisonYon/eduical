const COOKIE_NAME = 'educial_right_sidebar_collapsed'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365 // 1 year

export function getRightSidebarCollapsedFromCookie(): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`))
  return match?.[1] === '1'
}

export function setRightSidebarCollapsedCookie(collapsed: boolean): void {
  if (typeof document === 'undefined') return
  const value = collapsed ? '1' : '0'
  document.cookie = `${COOKIE_NAME}=${value};path=/;max-age=${MAX_AGE_SECONDS};SameSite=Lax`
}
