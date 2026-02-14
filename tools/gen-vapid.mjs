// tools/gen-vapid.mjs
import { webcrypto } from "node:crypto";

function bufToB64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const { subtle } = webcrypto;

const keys = await subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const privateJwk = await subtle.exportKey("jwk", keys.privateKey);
const publicRaw = await subtle.exportKey("raw", keys.publicKey); // 65 bytes (0x04 + X + Y)
const publicB64url = bufToB64url(publicRaw);

console.log("\n✅ VAPID generado:\n");
console.log("VITE_VAPID_PUBLIC_KEY=" + publicB64url);
console.log("\nVAPID_PRIVATE_JWK=" + JSON.stringify(privateJwk));
console.log("\n✅ Copia la PUBLIC al .env del frontend y la PRIVATE_JWK a Supabase Secrets.\n");
