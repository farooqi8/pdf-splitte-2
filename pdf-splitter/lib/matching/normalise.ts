export function normalisePermit(raw: string): string {
  return raw
    .toString()
    .trim()
    .toUpperCase()
    .replace(/[\s\-\.]/g, '') // remove spaces, dashes, dots
}

