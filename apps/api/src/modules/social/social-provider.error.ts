export class SocialProviderError extends Error {
  constructor(readonly code: string, readonly reconnect = false, readonly ambiguous = false) {
    super('The social provider could not complete this request');
  }
}
