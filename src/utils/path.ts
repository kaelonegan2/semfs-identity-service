import path from "node:path";

export function normalizeRepoPath(input: string): string {
  if (!input || typeof input !== "string") {
    throw new Error("Path is required");
  }
  if (path.isAbsolute(input)) {
    throw new Error(`Absolute paths are not allowed: ${input}`);
  }
  const normalized = path.posix.normalize(input.replaceAll("\\", "/"));
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`Path traversal is not allowed: ${input}`);
  }
  return normalized;
}

export function hasDottedPath(value: unknown, dottedPath: string): boolean {
  const parts = dottedPath.split(".");
  let cursor: unknown = value;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor !== undefined;
}

export function setDottedPath(target: Record<string, unknown>, dottedPath: string, value: unknown): void {
  const parts = dottedPath.split(".");
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    if (!cursor[part] || typeof cursor[part] !== "object") cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = value;
}
