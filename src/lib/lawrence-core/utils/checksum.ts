// Tiny dependency-free FNV-1a hash, used as a stand-in for content checksums
// (sha256 in production; this keeps the in-memory store self-contained).

export function checksum(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
