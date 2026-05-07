import { IdentityStore } from "../types/core.js";
import { notFound } from "../utils/errors.js";

export async function readJson<T = unknown>(store: IdentityStore, relPath: string): Promise<T> {
  try {
    return JSON.parse(await store.readText(relPath)) as T;
  } catch (error) {
    throw notFound(`Required JSON file is missing or invalid: ${relPath}`, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function readOptionalText(store: IdentityStore, relPath: string): Promise<string | null> {
  try {
    return await store.readText(relPath);
  } catch {
    return null;
  }
}
