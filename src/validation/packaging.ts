import type { Network } from "../specs/playableSpecs.js";
import { getPlayableSpecs } from "../specs/playableSpecs.js";

// Matches http(s)/ws(s)/ftp URLs and protocol-relative "//host" references inside
// attribute values or url(...) calls. data: and blob: URIs are intentionally excluded.
const EXTERNAL_URL_PATTERN = /\b(?:https?|wss?|ftp):\/\/[^\s"'()<>]+|url\(\s*\/\/[^)]+\)|src\s*=\s*["']\/\/[^"']+["']/gi;

const NETWORK_CALL_API_PATTERN = /\b(?:fetch|XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|EventSource)\s*\(/g;

// Heuristic set of exit-hook calls used by playable ad runtimes to trigger the
// app-store / install action. A real bundle only needs to match one of these.
const CTA_HOOK_PATTERNS = [
  /\bExitApi\s*\.\s*exit\s*\(/, // Meta Playable / IAB Exit API
  /\bmraid\s*\.\s*open\s*\(/i, // MRAID
  /\bwindow\s*\.\s*open\s*\(/,
  /\bgoogle_exit\s*\(/i, // Google/AdMob playable convention
  /data-cta\s*=/i,
];

export interface PackagingCheckResult {
  passed: boolean;
  issues: string[];
}

export function checkPackaging(bundleHtml: string, network: Network): PackagingCheckResult {
  const issues: string[] = [];
  const specs = getPlayableSpecs(network);
  const bundleBytes = Buffer.byteLength(bundleHtml, "utf8");

  for (const spec of specs) {
    if (bundleBytes > spec.maxBundleBytes) {
      issues.push(
        `Bundle is ${bundleBytes.toLocaleString()} bytes, exceeding the ${spec.displayName} limit of ${spec.maxBundleBytes.toLocaleString()} bytes.`,
      );
    }

    if (spec.externalNetworkCallsAllowed) continue;

    const externalUrlMatches = bundleHtml.match(EXTERNAL_URL_PATTERN);
    if (externalUrlMatches) {
      const sample = [...new Set(externalUrlMatches)].slice(0, 5);
      issues.push(
        `${spec.displayName}: bundle references external URL(s), which is not allowed in a self-contained playable: ${sample.join(", ")}`,
      );
    }

    const networkApiMatches = bundleHtml.match(NETWORK_CALL_API_PATTERN);
    if (networkApiMatches) {
      const sample = [...new Set(networkApiMatches)].slice(0, 5);
      issues.push(
        `${spec.displayName}: bundle calls a network API that won't work in an offline ad runtime: ${sample.join(", ")}`,
      );
    }

    if (spec.requiresCta) {
      const hasCta = CTA_HOOK_PATTERNS.some((pattern) => pattern.test(bundleHtml));
      if (!hasCta) {
        issues.push(
          `${spec.displayName}: no recognized call-to-action / exit hook found (expected one of: ExitApi.exit(), mraid.open(), window.open(), a google_exit() call, or a data-cta attribute).`,
        );
      }
    }
  }

  return { passed: issues.length === 0, issues };
}
