// Bound reads before buffering: the upstream parser cannot protect the BFF's
// memory, and Content-Length is optional for streamed requests.
export const MAX_PROXY_BODY_BYTES = 5 * 1024 * 1024;

export async function readProxyBody(request: Request): Promise<ArrayBuffer | undefined> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > MAX_PROXY_BODY_BYTES) {
    throw new RangeError("Request body is too large");
  }
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROXY_BODY_BYTES) {
        void reader.cancel().catch(() => undefined);
        throw new RangeError("Request body is too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}
