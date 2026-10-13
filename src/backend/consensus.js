import { digest, publicationReference, same } from './value.js';

/** Resolver is a trusted host port. Agents never supply publication records. */
export async function loadConsensus(manifest, resolve) {
  if (!manifest || typeof manifest.scope !== 'string' || !manifest.scope.trim() || !Array.isArray(manifest.references) || !manifest.references.length) throw new TypeError('Explicit consensus scope and references required');
  const references = manifest.references.map(publicationReference);
  for (const key of ['requiredIds', 'allowedScopes', 'requiredOperations']) {
    if (manifest[key] !== undefined && (!Array.isArray(manifest[key]) || manifest[key].some(value => typeof value !== 'string' || !value))) throw new TypeError(`Invalid manifest ${key}`);
  }
  if (manifest.requiredIds?.some(id => !references.some(ref => ref.id === id))) throw new Error('Required consensus missing');
  if (new Set(references.map(ref => ref.id)).size !== references.length) throw new TypeError('Duplicate consensus identity');
  const documents = [];
  for (const reference of references) {
    const record = await resolve(structuredClone(reference), { requiredOperations: manifest.requiredOperations ?? [] });
    if (!record || record.effective !== true || !same(publicationReference(record.reference), reference) || digest(record.data) !== reference.data_hash) throw new Error(`Consensus unavailable or mismatched: ${reference.id}`);
    if (manifest.allowedScopes && !manifest.allowedScopes.includes(record.data.scope?.iv)) throw new Error('Consensus scope mismatch');
    const dependencies = record.data.dependencies?.iv;
    if (dependencies !== undefined && (!Array.isArray(dependencies) || dependencies.some(dependency => !references.some(ref => same(ref, publicationReference(dependency)))))) throw new Error('Consensus dependency missing or mismatched');
    documents.push({ reference, data: structuredClone(record.data) });
  }
  return { scope: manifest.scope, references, documents, manifest: structuredClone({ ...manifest, references }) };
}
