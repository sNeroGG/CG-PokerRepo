import { register } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const hookUrl = pathToFileURL(
  path.join(import.meta.dirname, "alias-hook.mjs")
).href;

register(hookUrl);