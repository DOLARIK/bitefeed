#!/usr/bin/env tsx
/**
 * One-off setup script: generates the Ed25519 keypair used to sign certificates.
 * Run once per environment and paste the output into your .env file.
 *
 *   npx tsx scripts/generate-signing-keys.ts
 */
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privateDer = privateKey.export({ format: "der", type: "pkcs8" });
const publicDer = publicKey.export({ format: "der", type: "spki" });

console.log("Add these to your .env (never commit them):\n");
console.log(`CERT_SIGNING_PRIVATE_KEY=${privateDer.toString("base64")}`);
console.log(`CERT_SIGNING_PUBLIC_KEY=${publicDer.toString("base64")}`);
console.log("\nThe public key is safe to publish; it's how third parties verify certificates offline.");
