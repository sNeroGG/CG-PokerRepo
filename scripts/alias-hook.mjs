import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");

function existingFileUrl(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return pathToFileURL(candidate).href;
      }
    } catch {
      /* continue */
    }
  }
  return null;
}

function resolveAlias(specifier) {
  if (specifier.startsWith("@/")) {
    return existingFileUrl(path.join(root, "frontend/src", specifier.slice(2)));
  }
  if (specifier === "@cg/backend/types") {
    return existingFileUrl(path.join(root, "backend/src/types"));
  }
  if (specifier === "@cg/backend") {
    return existingFileUrl(path.join(root, "backend/src/index"));
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const aliased = resolveAlias(specifier);
  if (aliased) {
    return nextResolve(aliased, context);
  }

  if (specifier.startsWith(".") || specifier.startsWith("file:")) {
    const parent = context.parentURL
      ? path.dirname(new URL(context.parentURL).pathname.replace(/^\/([A-Za-z]:)/, "$1"))
      : root;
    const raw = specifier.startsWith("file:")
      ? new URL(specifier).pathname.replace(/^\/([A-Za-z]:)/, "$1")
      : path.resolve(parent, specifier);
    const found = existingFileUrl(raw);
    if (found) {
      return nextResolve(found, context);
    }
  }

  return nextResolve(specifier, context);
}
