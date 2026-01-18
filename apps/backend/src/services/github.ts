import { WithEnv } from "../utils/commonTypes";
import * as jose from "jose";
import {
  GitHubRepository,
  GitHubRepositorySchema,
  GitHubInstallation,
  GitHubInstallationSchema,
  GitHubInstallationAccessTokenSchema,
} from "../types/github";

/**
 * Service for interacting with GitHub API
 */

/**
 * Convert PKCS#1 (RSA) private key to PKCS#8 format
 * GitHub generates PKCS#1 keys but jose.importPKCS8 requires PKCS#8
 */
function convertPKCS1toPKCS8(pkcs1Key: string): string {
  // Extract the base64 content between the PEM headers
  const base64 = pkcs1Key
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
    .replace(/-----END RSA PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  // Decode base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // PKCS#8 wraps PKCS#1 with an AlgorithmIdentifier
  // RSA Algorithm OID: 1.2.840.113549.1.1.1
  const algorithmIdentifier = new Uint8Array([
    0x30, 0x0d, // SEQUENCE (13 bytes)
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // OID
    0x05, 0x00, // NULL
  ]);
  
  // Build PKCS#8 structure: SEQUENCE { version, algorithmIdentifier, privateKey }
  const version = new Uint8Array([0x02, 0x01, 0x00]); // INTEGER 0
  
  // Wrap PKCS#1 key as OCTET STRING
  const pkcs1Length = bytes.length;
  const lengthBytes = encodeDERLength(pkcs1Length);
  const octetString = new Uint8Array(1 + lengthBytes.length + pkcs1Length);
  octetString[0] = 0x04; // OCTET STRING tag
  octetString.set(lengthBytes, 1);
  octetString.set(bytes, 1 + lengthBytes.length);
  
  // Complete PKCS#8 structure
  const contentLength = version.length + algorithmIdentifier.length + octetString.length;
  const pkcs8LengthBytes = encodeDERLength(contentLength);
  const pkcs8 = new Uint8Array(1 + pkcs8LengthBytes.length + contentLength);
  pkcs8[0] = 0x30; // SEQUENCE tag
  pkcs8.set(pkcs8LengthBytes, 1);
  let offset = 1 + pkcs8LengthBytes.length;
  pkcs8.set(version, offset);
  offset += version.length;
  pkcs8.set(algorithmIdentifier, offset);
  offset += algorithmIdentifier.length;
  pkcs8.set(octetString, offset);
  
  // Convert to base64 and format as PEM
  const pkcs8Base64 = btoa(String.fromCharCode(...pkcs8));
  const pkcs8Pem = `-----BEGIN PRIVATE KEY-----\n${pkcs8Base64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
  
  return pkcs8Pem;
}

/**
 * Encode length in DER format
 */
function encodeDERLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }
  
  const lengthBytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    lengthBytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  
  return new Uint8Array([0x80 | lengthBytes.length, ...lengthBytes]);
}

/**
 * Generate a JWT token for GitHub App authentication using RS256
 */
async function generateGitHubAppJWT({ env }: WithEnv<{}>): Promise<string> {
  // Clean up the key string just in case
  let privateKeyPem = env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
  
  if (!privateKeyPem.includes("-----BEGIN PRIVATE KEY-----") && !privateKeyPem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    throw new Error(
      "GITHUB_APP_PRIVATE_KEY appears to be invalid. It is too short or missing the standard PEM header. " +
      "Make sure you used the contents of the .pem file, not the Client Secret."
    );
  }
  
  // Convert PKCS#1 to PKCS#8 if necessary
  if (privateKeyPem.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    privateKeyPem = convertPKCS1toPKCS8(privateKeyPem);
  }
  
  const privateKey = await jose.importPKCS8(privateKeyPem, "RS256");

  return new jose.SignJWT({
    iss: env.GITHUB_APP_ID, // GitHub App ID
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime("10m") // Expires in 10 minutes
    .sign(privateKey);
}

/**
 * Get an installation access token for a GitHub App installation
 */
export async function getInstallationAccessToken({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<{ token: string; expiresAt: string }> {
  const appJWT = await generateGitHubAppJWT({ env });

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJWT}`,
        "User-Agent": "CommitLens-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation access token: ${error}`);
  }

  const data = await response.json();
  const parsed = GitHubInstallationAccessTokenSchema.parse(data);

  return {
    token: parsed.token,
    expiresAt: parsed.expires_at,
  };
}

/**
 * Fetch repositories for a GitHub App installation
 */
export async function getInstallationRepositories({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<GitHubRepository[]> {
  const { token } = await getInstallationAccessToken({ env, installationId });

  const response = await fetch(
    "https://api.github.com/installation/repositories",
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "CommitLens-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch installation repositories: ${error}`);
  }

  const data: any = await response.json();
  const repositories = data.repositories || [];

  // Validate and parse each repository
  return repositories.map((repo: any) => GitHubRepositorySchema.parse(repo));
}

/**
 * Get installation details
 */
export async function getInstallation({
  env,
  installationId,
}: WithEnv<{ installationId: string }>): Promise<GitHubInstallation> {
  const appJWT = await generateGitHubAppJWT({ env });

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${appJWT}`,
        "User-Agent": "CommitLens-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation: ${error}`);
  }

  const data = await response.json();
  return GitHubInstallationSchema.parse(data);
}

/**
 * Verify GitHub webhook signature
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export async function verifyWebhookSignature({
  env,
  payload,
  signature,
}: WithEnv<{
  payload: string;
  signature: string;
}>): Promise<boolean> {
  const secret = env.GITHUB_WEBHOOK_SECRET;

  if (!signature.startsWith("sha256=")) {
    return false;
  }

  const signatureHash = signature.slice(7); // Remove 'sha256=' prefix

  // Import secret as a key
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Compute HMAC
  const payloadData = encoder.encode(payload);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadData);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  // Constant-time comparison
  return hashHex === signatureHash;
}
