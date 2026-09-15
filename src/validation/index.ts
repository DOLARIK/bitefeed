import type { Network } from "../specs/playableSpecs.js";
import { checkPackaging } from "./packaging.js";
import { checkManifestConsistency, parseManifest, type Manifest } from "./manifest.js";

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  manifest: Manifest | null;
}

/**
 * Runs the full server-side validation pass for a submitted bundle. This is
 * the trust boundary the certificate actually attests to — the extractor
 * skill may run the same checks locally first for a fast iteration loop, but
 * only this pass determines whether a certificate is issued.
 */
export function validateSubmission(bundleHtml: string, rawManifest: unknown, network: Network): ValidationResult {
  const manifestResult = parseManifest(rawManifest);
  if ("issues" in manifestResult) {
    return { passed: false, issues: manifestResult.issues, manifest: null };
  }

  const { manifest } = manifestResult;
  const packaging = checkPackaging(bundleHtml, network);
  const manifestConsistency = checkManifestConsistency(manifest);

  const issues = [...packaging.issues, ...manifestConsistency.issues];
  return { passed: issues.length === 0, issues, manifest };
}
