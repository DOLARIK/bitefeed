export type Network = "meta" | "google" | "both";

export interface PlayableSpec {
  network: "meta" | "google";
  displayName: string;
  maxBundleBytes: number;
  requiresSingleFile: boolean;
  requiresCta: boolean;
  externalNetworkCallsAllowed: boolean;
  notes: string[];
}

/**
 * v1 defaults for packaging limits. This is meant to mirror the extractor
 * skill's own `references/playable-specs.md` so both sides quote the same
 * numbers — treat this file as the source of truth to update first when the
 * networks change their limits, then port the change back to the skill.
 */
export const PLAYABLE_SPECS: Record<"meta" | "google", PlayableSpec> = {
  meta: {
    network: "meta",
    displayName: "Meta (Facebook/Instagram) Playable Ads",
    maxBundleBytes: 5 * 1024 * 1024, // 5 MB
    requiresSingleFile: true,
    requiresCta: true,
    externalNetworkCallsAllowed: false,
    notes: [
      "Bundle must be a single self-contained HTML file — no external CSS/JS/image/font requests.",
      "Must include a clear call-to-action that triggers the network's exit/install action (e.g. an MRAID or Meta Playable exit call).",
      "No autoplay audio without a visible mute control.",
    ],
  },
  google: {
    network: "google",
    displayName: "Google Ads / AdMob Playable Ads",
    maxBundleBytes: 5 * 1024 * 1024, // 5 MB
    requiresSingleFile: true,
    requiresCta: true,
    externalNetworkCallsAllowed: false,
    notes: [
      "Bundle must be a single self-contained HTML file with all assets inlined (base64 images/audio, inline CSS/JS).",
      "Must call the store/install exit action (e.g. via the Google/AdMob playable exit API or an MRAID equivalent).",
      "No external network calls of any kind — the ad units run in networks with no internet access.",
    ],
  },
};

export function getPlayableSpecs(network: Network): PlayableSpec[] {
  if (network === "both") return [PLAYABLE_SPECS.meta, PLAYABLE_SPECS.google];
  return [PLAYABLE_SPECS[network]];
}
