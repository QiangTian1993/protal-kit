export interface NavigationDecision {
  allowed: boolean
  reason?: string
}

export function isValidOrigin(origin: string) {
  try {
    const u = new URL(origin)
    return u.origin === origin && (u.protocol === 'http:' || u.protocol === 'https:')
  } catch {
    return false
  }
}

export function originOf(url: string) {
  return new URL(url).origin
}

export function decideNavigation(targetUrl: string, allowedOrigins: string[]): NavigationDecision {
  const targetOrigin = originOf(targetUrl)
  const allowed = allowedOrigins.includes(targetOrigin)
  return allowed ? { allowed: true } : { allowed: false, reason: `origin_not_allowed:${targetOrigin}` }
}

