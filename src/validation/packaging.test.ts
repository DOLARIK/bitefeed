import { describe, it, expect } from "vitest";
import { checkPackaging } from "./packaging.js";

const validBundle = `<!doctype html><html><body>
  <button onclick="ExitApi.exit()">Install now</button>
</body></html>`;

describe("checkPackaging", () => {
  it("passes a minimal self-contained bundle with a CTA hook", () => {
    const result = checkPackaging(validBundle, "meta");
    expect(result.passed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a bundle with an external URL reference", () => {
    const bundle = `<html><body><img src="https://cdn.example.com/logo.png"><button onclick="ExitApi.exit()">Go</button></body></html>`;
    const result = checkPackaging(bundle, "meta");
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("external URL"))).toBe(true);
  });

  it("flags a bundle that calls fetch()", () => {
    const bundle = `<html><body><script>fetch('/api/data')</script><button onclick="mraid.open('x')">Go</button></body></html>`;
    const result = checkPackaging(bundle, "google");
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("network API"))).toBe(true);
  });

  it("flags a bundle missing a CTA hook", () => {
    const bundle = `<html><body><p>No exit call here.</p></body></html>`;
    const result = checkPackaging(bundle, "meta");
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("call-to-action"))).toBe(true);
  });

  it("flags an oversized bundle", () => {
    const bundle = `<html><body><button onclick="ExitApi.exit()">Go</button>${"x".repeat(6 * 1024 * 1024)}</body></html>`;
    const result = checkPackaging(bundle, "meta");
    expect(result.passed).toBe(false);
    expect(result.issues.some((issue) => issue.includes("exceeding"))).toBe(true);
  });

  it("checks both networks when network is 'both'", () => {
    const result = checkPackaging(validBundle, "both");
    expect(result.passed).toBe(true);
  });
});
