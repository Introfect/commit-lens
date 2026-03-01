/**
 * Logging utility with correlation IDs and structured logging
 */

import { ErrorWithMessage, getErrorMessage } from "./error";

export type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly LogValue[]
  | { readonly [key: string]: LogValue };

export type LogData = { readonly [key: string]: LogValue };

export type LogContext = {
  correlationId: string;
  prNumber?: string;
  repositoryId?: string;
  eventId?: string;
  operation?: string;
  readonly [key: string]: LogValue;
};

function isErrorWithMessage(
  value: ErrorWithMessage | LogData | null | undefined
): value is ErrorWithMessage {
  return (
    value instanceof Error ||
    (typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof value.message === "string")
  );
}

export class Logger {
  private readonly context: LogContext;

  constructor(context: LogContext) {
    this.context = context;
  }

  private formatMessage(level: string, message: string, data?: LogData): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...this.context,
      ...(data && { data }),
    };
    return JSON.stringify(logEntry);
  }

  /**
   * Get the correlation ID for this logger
   */
  public get correlationId(): string {
    return this.context.correlationId;
  }

  info(message: string, data?: LogData) {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: LogData) {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(
    message: string,
    errorOrData?: ErrorWithMessage | LogData | null,
    data?: LogData
  ) {
    const errorData = isErrorWithMessage(errorOrData)
      ? {
          error: getErrorMessage(errorOrData),
          ...(errorOrData.stack ? { stack: errorOrData.stack } : {}),
          ...data,
        }
      : errorOrData;

    console.error(
      this.formatMessage(
        'ERROR',
        message,
        errorData === null ? undefined : errorData
      )
    );
  }

  debug(message: string, data?: LogData) {
    console.log(this.formatMessage('DEBUG', message, data));
  }

  // Create child logger with additional context
  child(additionalContext: Partial<LogContext>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(context: LogContext): Logger {
  return new Logger(context);
}

/**
 * Generate a correlation ID for tracking requests
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
