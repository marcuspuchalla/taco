/**
 * Logger utility for CBOR decoder library
 * Provides configurable logging with different levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

interface LoggerConfig {
  level: LogLevel
  prefix?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
}

let config: LoggerConfig = {
  level: 'warn',
  prefix: '[CBOR]'
}

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig }
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...config }
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level]
}

function formatMessage(message: string): string {
  return config.prefix ? `${config.prefix} ${message}` : message
}

/**
 * Log a debug message
 */
export function debug(message: string, ...args: unknown[]): void {
  if (shouldLog('debug')) {
    console.debug(formatMessage(message), ...args)
  }
}

/**
 * Log an info message
 */
export function info(message: string, ...args: unknown[]): void {
  if (shouldLog('info')) {
    console.info(formatMessage(message), ...args)
  }
}

/**
 * Log a warning message
 */
export function warn(message: string, ...args: unknown[]): void {
  if (shouldLog('warn')) {
    console.warn(formatMessage(message), ...args)
  }
}

/**
 * Log an error message
 */
export function error(message: string, ...args: unknown[]): void {
  if (shouldLog('error')) {
    console.error(formatMessage(message), ...args)
  }
}

/**
 * Logger object for convenience
 */
export const logger = {
  debug,
  info,
  warn,
  error,
  configure: configureLogger,
  getConfig: getLoggerConfig
}

export default logger
