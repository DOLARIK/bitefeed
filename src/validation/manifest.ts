import { z } from "zod";

// v1 shape produced by the `playable-demo-extractor` skill. Kept intentionally
// loose (`.passthrough()`) since the skill evolves independently of this
// service — only the fields the server actually checks are constrained.
export const manifestSchema = z
  .object({
    commit_hash: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/i, "commit_hash must be a hex git SHA (short or full)"),
    repo: z.string().optional(),
    components_used: z
      .array(
        z
          .object({
            name: z.string().min(1),
            source_path: z.string().min(1),
            type: z.string().optional(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export type Manifest = z.infer<typeof manifestSchema>;

const PLACEHOLDER_PATTERNS = [/\btodo\b/i, /\bfixme\b/i, /\bexample\b/i, /\blorem\b/i, /\bplaceholder\b/i, /^n\/?a$/i];

export interface ManifestCheckResult {
  passed: boolean;
  issues: string[];
}

/**
 * Checks that every `components_used` entry has a plausible source path — no
 * path traversal, no empty/placeholder values. This does not (and cannot,
 * since we never receive the source repo) verify the path actually exists.
 */
export function checkManifestConsistency(manifest: Manifest): ManifestCheckResult {
  const issues: string[] = [];

  manifest.components_used.forEach((component, index) => {
    const label = component.name || `components_used[${index}]`;

    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(component.name))) {
      issues.push(`${label}: name looks like a placeholder ("${component.name}").`);
    }

    const sourcePath = component.source_path;
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(sourcePath))) {
      issues.push(`${label}: source_path looks like a placeholder ("${sourcePath}").`);
    }

    if (sourcePath.includes("..")) {
      issues.push(`${label}: source_path contains "..", which is not a plausible in-repo path ("${sourcePath}").`);
    }

    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(sourcePath)) {
      issues.push(`${label}: source_path is a URL, not an in-repo path ("${sourcePath}").`);
    }
  });

  return { passed: issues.length === 0, issues };
}

export function parseManifest(manifest: unknown): { manifest: Manifest } | { issues: string[] } {
  const result = manifestSchema.safeParse(manifest);
  if (!result.success) {
    return { issues: result.error.issues.map((issue) => `manifest.${issue.path.join(".")}: ${issue.message}`) };
  }
  return { manifest: result.data };
}
