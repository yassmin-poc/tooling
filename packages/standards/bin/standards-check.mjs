#!/usr/bin/env node
// standards-check: compares a product folder with the manifest of this package version.
// Usage: standards-check [product-folder]   (default: current folder)
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(pkgRoot, "manifest.json"), "utf8"));
const dir = process.argv[2] ?? ".";
const today = new Date(new Date().toISOString().slice(0, 10));
const MAX_DAYS = 183;

const read = (p) => readFileSync(join(dir, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const getPath = (obj, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
const nums = (v) =>
  String(v)
    .replace(/^[^\d]*/, "")
    .split(".")
    .map(Number);
const atLeast = (a, b) => {
  const [x, y] = [nums(a), nums(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  return true;
};
let tagShas;
const releasedShas = (repoUrl) => {
  if (!tagShas) {
    const out = execFileSync("git", ["ls-remote", "--tags", repoUrl], { encoding: "utf8" });
    tagShas = new Set(
      out
        .split("\n")
        .filter(Boolean)
        .map((l) => l.split("\t")[0]),
    );
  }
  return tagShas;
};

// Returns null when the item conforms, or a message when it does not.
function check(item) {
  const c = item.check;
  const has = existsSync(join(dir, item.path));
  switch (c.kind) {
    case "exists":
      return has ? null : `${item.path} is missing`;
    case "absent":
      return has ? `${item.path} must not exist in a product (${c.why})` : null;
    case "sameAsTemplate": {
      if (!has) return `${item.path} is missing`;
      const want = readFileSync(join(pkgRoot, "templates", c.template), "utf8").replace(
        /\r\n/g,
        "\n",
      );
      return read(item.path).replace(/\r\n/g, "\n") === want
        ? null
        : `${item.path} differs from the shared version`;
    }
    case "contains": {
      if (!has) return `${item.path} is missing`;
      const missing = c.patterns.filter((p) => !new RegExp(p).test(read(item.path)));
      return missing.length ? `${item.path} lacks: ${missing.join(", ")}` : null;
    }
    case "notContains": {
      if (!has) return null;
      const found = c.patterns.filter((p) => new RegExp(p).test(read(item.path)));
      return found.length ? `${item.path} contains: ${found.join(", ")}` : null;
    }
    case "jsonEquals": {
      if (!has) return `${item.path} is missing`;
      const v = getPath(readJson(item.path), c.key);
      return v === c.value
        ? null
        : `${item.path}: ${c.key} is ${JSON.stringify(v)}, expected ${JSON.stringify(c.value)}`;
    }
    case "jsonNotTrue":
      return has && getPath(readJson(item.path), c.key) === true
        ? `${item.path}: ${c.key} must not be true`
        : null;
    case "arrayIncludes": {
      if (!has) return `${item.path} is missing`;
      const arr = getPath(readJson(item.path), c.key) ?? [];
      const missing = c.values.filter((v) => !arr.includes(v));
      return missing.length ? `${item.path}: ${c.key} lacks ${missing.join(", ")}` : null;
    }
    case "dependencyAtLeast": {
      const pkg = readJson("package.json");
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const bad = Object.entries(c.packages).filter(
        ([n, min]) => !deps[n] || !atLeast(deps[n], min),
      );
      return bad.length
        ? bad.map(([n, min]) => `${n} is ${deps[n] ?? "missing"}, minimum ${min}`).join("; ")
        : null;
    }
    case "pinnedToRelease": {
      if (!has) return `${item.path} is missing`;
      const m = read(item.path).match(new RegExp(c.pattern));
      if (!m) return `${item.path} does not call ${c.describe} at a full commit SHA`;
      return releasedShas(c.repoUrl).has(m[1])
        ? null
        : `${item.path} pins ${m[1]}, which is not a released tag of ${c.repoUrl}`;
    }
    default:
      return `unknown check kind ${c.kind}`;
  }
}

const errors = [];
const waived = [];
const exFile = ".standards/exceptions.json";
const exceptions = existsSync(join(dir, exFile)) ? (readJson(exFile).exceptions ?? []) : [];
const byItem = new Map();
for (const e of exceptions) {
  const where = `exception ${e.id ?? "(no id)"}`;
  const missing = ["id", "item", "change", "reason", "jira", "expires"].filter((f) => !e[f]);
  if (missing.length) {
    errors.push(`${where}: missing ${missing.join(", ")}`);
    continue;
  }
  const item = manifest.items.find((i) => i.id === e.item);
  if (!item) {
    errors.push(`${where}: no shared item ${e.item}`);
    continue;
  }
  if (item.exceptionAllowed === false) {
    errors.push(`${where}: ${e.item} allows no exception`);
    continue;
  }
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(e.jira)) {
    errors.push(`${where}: jira "${e.jira}" is not an issue key`);
    continue;
  }
  const exp = new Date(e.expires);
  if (Number.isNaN(exp.getTime())) {
    errors.push(`${where}: expires "${e.expires}" is not a date`);
    continue;
  }
  if (exp < today) {
    errors.push(`${where}: expired on ${e.expires}`);
    continue;
  }
  if ((exp - today) / 86400000 > MAX_DAYS) {
    errors.push(`${where}: expires more than six months ahead`);
    continue;
  }
  byItem.set(e.item, e);
}

for (const item of manifest.items) {
  if (item.level === "default" || item.level === "product-owned") continue;
  const problem = check(item);
  const ex = byItem.get(item.id);
  if (problem && ex)
    waived.push(`${item.id}: ${problem} (waived by ${ex.id}, ${ex.jira}, until ${ex.expires})`);
  else if (problem) errors.push(`${item.id} [${item.level}]: ${problem}`);
  else if (ex)
    errors.push(`exception ${ex.id}: stale, ${item.id} already conforms; remove the entry`);
}

const lines = [
  `standards-check ${manifest.version}: ${errors.length ? "FAILED" : "passed"}`,
  ...errors.map((e) => `FAIL ${e}`),
  ...waived.map((w) => `EXCEPTION ${w}`),
];
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    ["## standards-check", "", ...lines.map((l) => `- ${l}`), ""].join("\n"),
  );
}
process.exit(errors.length ? 1 : 0);
