type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (process.env.NODE_ENV === "development") {
    const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[method](`[${level.toUpperCase()}] ${message}`, Object.keys(fields).length ? fields : "");
    return;
  }

  // Structured JSON in staging/production.
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method](JSON.stringify(entry));
}

export const logger = {
  debug: (message: string, fields?: LogFields) => log("debug", message, fields),
  info: (message: string, fields?: LogFields) => log("info", message, fields),
  warn: (message: string, fields?: LogFields) => log("warn", message, fields),
  error: (message: string, fields?: LogFields) => log("error", message, fields),
};
