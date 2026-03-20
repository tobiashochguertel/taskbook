/** AES-256-GCM encryption/decryption compatible with the Rust CLI's scheme */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base64Encode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function _concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

const HEX_RE = /^[0-9a-fA-F]+$/;

/** Parse a key string that may be hex (64 chars) or base64 (44 chars) into raw bytes. */
function parseKeyBytes(key: string): Uint8Array {
  const trimmed = key.trim();
  if (trimmed.length === 64 && HEX_RE.test(trimmed)) {
    return hexToBytes(trimmed);
  }
  // base64-encoded 32-byte key (standard or URL-safe)
  return base64Decode(trimmed);
}

export async function deriveKey(encryptionKey: string): Promise<CryptoKey> {
  const keyData = parseKeyBytes(encryptionKey);
  if (keyData.length !== 32) {
    throw new Error(
      `Invalid key length: expected 32 bytes, got ${keyData.length}`,
    );
  }
  return crypto.subtle.importKey("raw", keyData, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<{ data: string; nonce: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return {
    data: base64Encode(new Uint8Array(ciphertext)),
    nonce: base64Encode(iv),
  };
}

export async function decrypt(
  data: string,
  nonce: string,
  key: CryptoKey,
): Promise<string> {
  const ciphertext = base64Decode(data);
  const iv = base64Decode(nonce);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}
