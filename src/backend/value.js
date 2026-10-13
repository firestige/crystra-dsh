import { createHash } from 'node:crypto';

export function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('Expected a JSON value');
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const same = (left, right) => canonical(left) === canonical(right);
export const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

export function publicationReference(value) {
  if (!plain(value) || !['id', 'publication_event_id', 'actor'].every(key => typeof value[key] === 'string' && value[key].length > 0)
    || !Number.isSafeInteger(value.published_version) || value.published_version < 0 || !/^[a-f0-9]{64}$/.test(value.data_hash)) {
    throw new TypeError('Invalid publication reference');
  }
  return Object.fromEntries(['id', 'published_version', 'publication_event_id', 'actor', 'data_hash'].map(key => [key, value[key]]));
}
