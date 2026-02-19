type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
}

const isProd = process.env.NODE_ENV === 'production'

function formatLog(entry: LogEntry): string {
  if (isProd) {
    return JSON.stringify(entry)
  }
  const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : ''
  return `[${entry.level.toUpperCase()}] ${entry.message}${ctx}`
}

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && { context }),
  }

  const formatted = formatLog(entry)

  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    default:
      console.log(formatted)
  }
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
}
