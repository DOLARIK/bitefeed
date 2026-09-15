import { describe, it, expect } from "vitest";
import { signCertificate, verifyCertificateSignature, hashManifest, type SignedCertificateFacts } from "./signing.js";

const facts: SignedCertificateFacts = {
  certificateId: "11111111-1111-1111-1111-111111111111",
  accountId: "22222222-2222-2222-2222-222222222222",
  commitHash: "a1b2c3d4e5f6",
  network: "meta",
  manifestHash: hashManifest({ commit_hash: "a1b2c3d4e5f6", components_used: [] }),
  issuedAt: "2026-09-15T00:00:00.000Z",
};

describe("certificate signing", () => {
  it("produces a signature that verifies against the same facts", () => {
    const signature = signCertificate(facts);
    expect(verifyCertificateSignature(facts, signature)).toBe(true);
  });

  it("fails verification if any fact is tampered with", () => {
    const signature = signCertificate(facts);
    expect(verifyCertificateSignature({ ...facts, commitHash: "deadbeef" }, signature)).toBe(false);
  });

  it("fails verification against a corrupted signature", () => {
    const signature = signCertificate(facts);
    const corrupted = signature.slice(0, -2) + (signature.at(-2) === "A" ? "B" : "A") + signature.at(-1);
    expect(verifyCertificateSignature(facts, corrupted)).toBe(false);
  });

  it("hashManifest is deterministic for the same object shape", () => {
    expect(hashManifest({ a: 1, b: 2 })).toBe(hashManifest({ a: 1, b: 2 }));
  });
});
