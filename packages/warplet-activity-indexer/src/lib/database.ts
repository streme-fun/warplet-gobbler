type ResolveDatabaseConnectionStringOptions = {
  sslMode?: string;
};

export type DatabaseConnectionSummary = {
  protocol: string;
  host: string;
  port: string;
  database: string;
  user: string;
  sslmode: string | null;
};

export function resolveDatabaseConnectionString(
  value: string | undefined,
  options: ResolveDatabaseConnectionStringOptions = {},
): string | undefined {
  if (!value) return undefined;

  const sslMode = options.sslMode?.trim().toLowerCase();
  if (!sslMode) return value;

  const url = new URL(value);
  url.searchParams.delete("ssl");
  url.searchParams.delete("sslmode");

  if (sslMode !== "disable") {
    url.searchParams.set("sslmode", sslMode);
  }

  return url.toString();
}

export function summarizeDatabaseConnectionString(
  value: string | undefined,
): DatabaseConnectionSummary | null {
  if (!value) return null;

  const url = new URL(value);
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port,
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username),
    sslmode: url.searchParams.get("sslmode"),
  };
}