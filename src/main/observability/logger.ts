export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug: (event: string, data?: Record<string, unknown>) => void
  info: (event: string, data?: Record<string, unknown>) => void
  warn: (event: string, data?: Record<string, unknown>) => void
  error: (event: string, data?: Record<string, unknown>) => void
}

function emit(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(data ? { data } : {})
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function createLogger(): Logger {
  return {
    debug: (event, data) => emit('debug', event, data),
    info: (event, data) => emit('info', event, data),
    warn: (event, data) => emit('warn', event, data),
    error: (event, data) => emit('error', event, data)
  }
}

