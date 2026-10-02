// Local image labels are a source-binding check, not release attestations.
export function validateDevelopmentImage(image, expected) {
 const labels=image?.Config?.Labels;
 if(!/^sha256:[a-f0-9]{64}$/u.test(image?.Id??'') ||
    labels?.['org.opencontainers.image.source']!==`https://github.com/${expected.repository}` ||
    labels?.['org.opencontainers.image.revision']!==expected.revision) {
  throw new Error('DEVELOPMENT_SERVICE_IMAGE_MISMATCH');
 }
 return image.Id;
}
