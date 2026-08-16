/**
 * Ids are generated client-side so a new crew or assignment exists immediately,
 * before any round trip. `crypto.randomUUID` is available in every browser this
 * app targets; the fallback covers insecure origins, where it is absent.
 */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
