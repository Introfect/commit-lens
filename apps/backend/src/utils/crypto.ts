import { WithEnv } from "./commonTypes";

const ALGORITHM = {
  name: "AES-GCM",
  iv: new Uint8Array(12), // 12-byte IV (nonce) is standard for AES-GCM
};
const KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt"];

async function getEncryptionKey(env: Env): Promise<CryptoKey> {
  const keyBuffer = Uint8Array.from(atob(env.ENCRYPTION_KEY), (c) =>
    c.charCodeAt(0)
  );
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    ALGORITHM,
    false, // not exportable
    KEY_USAGES
  );
}

export async function encrypt(
  text: string,
  env: Env
): Promise<string> {
  const key = await getEncryptionKey(env);
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(ALGORITHM, key, encoded);

  const iv = ALGORITHM.iv; // In a real app, generate a new random IV for each encryption and store it with the ciphertext. For simplicity, we are using a fixed IV here.

  const encryptedArray = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  encryptedArray.set(new Uint8Array(iv), 0);
  encryptedArray.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...encryptedArray));
}

export async function decrypt(
  encryptedText: string,
  env: Env
): Promise<string> {
  const key = await getEncryptionKey(env);
  const encryptedArray = Uint8Array.from(atob(encryptedText), (c) =>
    c.charCodeAt(0)
  );

  const iv = encryptedArray.slice(0, ALGORITHM.iv.byteLength);
  const ciphertext = encryptedArray.slice(ALGORITHM.iv.byteLength);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM.name, iv: iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
