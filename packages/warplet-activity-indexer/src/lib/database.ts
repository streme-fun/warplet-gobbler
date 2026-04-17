type ResolveDatabaseConnectionStringOptions = {
  sslMode?: string;
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