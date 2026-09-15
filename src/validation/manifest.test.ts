import { describe, it, expect } from "vitest";
import { parseManifest, checkManifestConsistency } from "./manifest.js";

describe("parseManifest", () => {
  it("accepts a well-formed manifest", () => {
    const result = parseManifest({
      commit_hash: "a1b2c3d4e5f6",
      repo: "acme/app",
      components_used: [{ name: "OnboardingFlow", source_path: "src/screens/Onboarding.tsx" }],
    });
    expect("manifest" in result).toBe(true);
  });

  it("rejects a missing commit_hash", () => {
    const result = parseManifest({ components_used: [] });
    expect("issues" in result).toBe(true);
  });

  it("rejects a malformed commit_hash", () => {
    const result = parseManifest({ commit_hash: "not-a-sha!" });
    expect("issues" in result).toBe(true);
  });
});

describe("checkManifestConsistency", () => {
  it("passes plausible component entries", () => {
    const result = checkManifestConsistency({
      commit_hash: "a1b2c3d4e5f6",
      components_used: [{ name: "OnboardingFlow", source_path: "src/screens/Onboarding.tsx" }],
    });
    expect(result.passed).toBe(true);
  });

  it("flags a placeholder source path", () => {
    const result = checkManifestConsistency({
      commit_hash: "a1b2c3d4e5f6",
      components_used: [{ name: "OnboardingFlow", source_path: "TODO/placeholder.tsx" }],
    });
    expect(result.passed).toBe(false);
  });

  it("flags a path traversal attempt", () => {
    const result = checkManifestConsistency({
      commit_hash: "a1b2c3d4e5f6",
      components_used: [{ name: "OnboardingFlow", source_path: "../../etc/passwd" }],
    });
    expect(result.passed).toBe(false);
  });

  it("flags a URL used as a source path", () => {
    const result = checkManifestConsistency({
      commit_hash: "a1b2c3d4e5f6",
      components_used: [{ name: "OnboardingFlow", source_path: "https://example.com/foo.tsx" }],
    });
    expect(result.passed).toBe(false);
  });
});
