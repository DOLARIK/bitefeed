import { z } from "zod";
import { requireAccount } from "../../auth/context.js";
import { getPlayableSpecs } from "../../specs/playableSpecs.js";
import { toolResult, toolError } from "../toolResult.js";

export const getPlayableSpecsInputShape = {
  network: z.enum(["meta", "google"]),
};

export async function getPlayableSpecsHandler(args: { network: "meta" | "google" }) {
  try {
    requireAccount();
  } catch (error) {
    return toolError((error as Error).message);
  }

  const [spec] = getPlayableSpecs(args.network);
  return toolResult({ ...spec });
}
