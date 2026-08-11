#!/usr/bin/env node

/**
 * Update the static OpenCode Go model list used by the local ACP preset.
 *
 * Source of truth:
 *   https://opencode.ai/zen/go/v1/models
 *
 * OpenCode config model IDs use:
 *   opencode-go/<model-id>
 *
 * Usage:
 *   node scripts/update-opencode-go-models.mjs
 *   node scripts/update-opencode-go-models.mjs --check
 *
 * The script intentionally updates only OPENCODE_GO_MODELS in
 * src/constants/acp-providers.ts. Existing labels are preserved when an ID
 * remains present. Labels for newly discovered IDs are generated heuristically
 * and should be reviewed in the resulting diff.
 */

import fs from "node:fs/promises";
import process from "node:process";

const MODELS_URL = "https://opencode.ai/zen/go/v1/models";
const TARGET_FILE = new URL(
  "../src/constants/acp-providers.ts",
  import.meta.url,
);
const MODEL_PREFIX = "opencode-go/";

const MODELS_BLOCK_PATTERN =
  /(const OPENCODE_GO_MODELS: ACPModelOption\[\] = \[\r?\n)([\s\S]*?)(^\];)/m;

function formatVersionPart(value) {
  // "5.6" -> "5.6", "k2.7" is handled by the caller.
  return value;
}

function titleWord(word) {
  if (!word) return word;

  const upper = word.toUpperCase();

  // Preserve/common-normalize model-family acronyms.
  if (upper === "GPT") return "GPT";
  if (upper === "GLM") return "GLM";
  if (upper === "QWEN") return "Qwen";
  if (upper === "KIMI") return "Kimi";
  if (upper === "GROK") return "Grok";
  if (upper === "DEEPSEEK") return "DeepSeek";
  if (upper === "MINIMAX") return "MiniMax";
  if (upper === "MIMO") return "MiMo";
  if (upper === "HY3") return "Hy3";

  if (/^[kmv]\d+(?:\.\d+)*$/i.test(word)) {
    return `${word[0].toUpperCase()}${formatVersionPart(word.slice(1))}`;
  }

  if (/^\d+(?:\.\d+)*$/.test(word)) return word;

  return word[0].toUpperCase() + word.slice(1);
}

function generateLabel(modelId) {
  // These replacements reproduce the labels currently used in the downstream
  // OpenCode provider list and keep labels readable for likely future IDs.
  const parts = modelId.split("-");

  if (modelId.startsWith("glm-")) {
    return `GLM-${parts.slice(1).join("-")}`;
  }

  if (modelId.startsWith("gpt-")) {
    return `GPT-${parts.slice(1, 2).join("-")}${
      parts.length > 2 ? ` ${parts.slice(2).map(titleWord).join(" ")}` : ""
    }`;
  }

  if (modelId.startsWith("mimo-")) {
    return `MiMo-${parts.slice(1).map(titleWord).join("-")}`;
  }

  if (modelId.startsWith("hy3")) {
    return parts.length === 1
      ? "Hy3"
      : `Hy3 ${parts.slice(1).map(titleWord).join(" ")}`;
  }

  return parts.map(titleWord).join(" ");
}

function parseExistingLabels(block) {
  const labels = new Map();
  const itemPattern =
    /\{\s*id:\s*"opencode-go\/([^"]+)",\s*label:\s*"([^"]+)"\s*\}/g;

  for (const match of block.matchAll(itemPattern)) {
    labels.set(match[1], match[2]);
  }

  return labels;
}

function renderModels(modelIds, existingLabels) {
  return modelIds
    .map((modelId) => {
      const label = existingLabels.get(modelId) ?? generateLabel(modelId);
      return `  { id: "${MODEL_PREFIX}${modelId}", label: "${label}" },`;
    })
    .join("\n");
}

async function fetchModelIds() {
  const response = await fetch(MODELS_URL, {
    headers: {
      accept: "application/json",
      "user-agent": "OpenHands-OpenCode-Go-model-updater",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${MODELS_URL}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();

  if (!payload || !Array.isArray(payload.data)) {
    throw new Error("Unexpected OpenCode Go models response: missing data[]");
  }

  const ids = payload.data.map((entry) => entry?.id);

  if (ids.some((id) => typeof id !== "string" || id.length === 0)) {
    throw new Error("Unexpected OpenCode Go models response: invalid model id");
  }

  const unique = [...new Set(ids)];

  if (unique.length !== ids.length) {
    throw new Error("Unexpected OpenCode Go models response: duplicate model ids");
  }

  if (unique.length === 0) {
    throw new Error("OpenCode Go models response contains no models");
  }

  return unique;
}

async function main() {
  const checkOnly = process.argv.slice(2).includes("--check");
  const unknownArgs = process.argv
    .slice(2)
    .filter((arg) => arg !== "--check");

  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }

  const source = await fs.readFile(TARGET_FILE, "utf8");
  const blockMatch = source.match(MODELS_BLOCK_PATTERN);

  if (!blockMatch || blockMatch.index === undefined) {
    throw new Error(
      "Could not find OPENCODE_GO_MODELS in src/constants/acp-providers.ts",
    );
  }

  const [, blockStart, existingBlock, blockEnd] = blockMatch;
  const existingLabels = parseExistingLabels(existingBlock);

  const modelIds = await fetchModelIds();
  const rendered = renderModels(modelIds, existingLabels);
  const replacement = `${blockStart}${rendered}\n${blockEnd}`;
  const updated =
    source.slice(0, blockMatch.index) +
    replacement +
    source.slice(blockMatch.index + blockMatch[0].length);

  if (updated === source) {
    console.log(`OpenCode Go model list is already up to date (${modelIds.length} models).`);
    return;
  }

  const oldIds = [...existingLabels.keys()];
  const newIdSet = new Set(modelIds);
  const oldIdSet = new Set(oldIds);

  const added = modelIds.filter((id) => !oldIdSet.has(id));
  const removed = oldIds.filter((id) => !newIdSet.has(id));

  console.log(`OpenCode Go model catalog changed: ${oldIds.length} -> ${modelIds.length}`);
  if (added.length > 0) {
    console.log(`Added:   ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    console.log(`Removed: ${removed.join(", ")}`);
  }

  if (checkOnly) {
    console.error(
      "src/constants/acp-providers.ts is out of date. Run this script without --check.",
    );
    process.exitCode = 1;
    return;
  }

  await fs.writeFile(TARGET_FILE, updated, "utf8");
  console.log("Updated src/constants/acp-providers.ts.");
  if (added.length > 0) {
    console.log(
      "Review labels for newly added models, then run the ACP/provider tests.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
