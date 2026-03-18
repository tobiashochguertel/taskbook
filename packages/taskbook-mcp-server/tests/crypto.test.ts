import { describe, expect, test } from "bun:test";
import { deriveKey, encrypt, decrypt } from "../src/client/crypto.js";

describe("crypto", () => {
  const hexKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  test("deriveKey accepts 64-char hex string", async () => {
    const key = await deriveKey(hexKey);
    expect(key).toBeDefined();
    expect(key.algorithm).toEqual({ name: "AES-GCM", length: 256 });
  });

  test("deriveKey accepts base64 string (44 chars)", async () => {
    // 32 random bytes → base64
    const raw = new Uint8Array(32);
    crypto.getRandomValues(raw);
    let binary = "";
    for (const byte of raw) binary += String.fromCharCode(byte);
    const b64 = btoa(binary);

    const key = await deriveKey(b64);
    expect(key).toBeDefined();
  });

  test("deriveKey rejects invalid key length", async () => {
    await expect(deriveKey("aabbcc")).rejects.toThrow("Invalid key length");
  });

  test("encrypt then decrypt round-trip", async () => {
    const key = await deriveKey(hexKey);
    const plaintext = "Hello, taskbook MCP!";
    const { data, nonce } = await encrypt(plaintext, key);

    expect(data).toBeTruthy();
    expect(nonce).toBeTruthy();

    const decrypted = await decrypt(data, nonce, key);
    expect(decrypted).toBe(plaintext);
  });

  test("encrypt produces different ciphertexts (random nonce)", async () => {
    const key = await deriveKey(hexKey);
    const { data: d1 } = await encrypt("same", key);
    const { data: d2 } = await encrypt("same", key);
    expect(d1).not.toBe(d2);
  });

  test("decrypt fails with wrong key", async () => {
    const key1 = await deriveKey(hexKey);
    const key2 = await deriveKey(
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    );
    const { data, nonce } = await encrypt("secret", key1);
    await expect(decrypt(data, nonce, key2)).rejects.toThrow();
  });

  test("handles unicode text", async () => {
    const key = await deriveKey(hexKey);
    const text = "Aufgabe erledigt 🎉 — Ü ö ä ß";
    const { data, nonce } = await encrypt(text, key);
    const result = await decrypt(data, nonce, key);
    expect(result).toBe(text);
  });
});
