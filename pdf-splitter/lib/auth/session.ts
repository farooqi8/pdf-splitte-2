export const AUTH_COOKIE_NAME = 'ps_auth' as const

export function getAuthCookieValue(): string {
  // Keep value simple; cookie presence is the check.
  return '1'
}

