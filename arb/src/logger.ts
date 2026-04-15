type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_RANK: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "INFO";

function fmt(level: LogLevel, msg: string, data?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.padEnd(5)} ${msg}`;
  if (!data || Object.keys(data).length === 0) return base;
  return `${base} ${JSON.stringify(data)}`;
}

function emit(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;
  const line = fmt(level, msg, data);
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) => emit("DEBUG", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit("INFO", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("WARN", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("ERROR", msg, data),
};
