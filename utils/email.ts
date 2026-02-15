export function normalizeEmail(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return normalized ? normalized : undefined;
}
