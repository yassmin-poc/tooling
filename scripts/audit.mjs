import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const { products, baseline } = JSON.parse(readFileSync("audit/products.json", "utf8"));
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
const out = ["# Standards audit", ""];
for (const name of products) {
  const repo = `yassmin-poc/${name}`;
  out.push(`## ${repo}`, "");
  const settings = JSON.parse(gh("api", `repos/${repo}`));
  const drift = Object.entries(baseline).filter(([k, v]) => settings[k] !== v);
  out.push(
    drift.length
      ? drift.map(([k, v]) => `- Setting drift: ${k} is ${settings[k]}, baseline ${v}`).join("\n")
      : "- Settings match the baseline",
  );
  let exceptions = [];
  try {
    exceptions =
      JSON.parse(
        gh(
          "api",
          "-H",
          "Accept: application/vnd.github.raw+json",
          `repos/${repo}/contents/.standards/exceptions.json`,
        ),
      ).exceptions ?? [];
  } catch {
    out.push("- No .standards/exceptions.json found");
  }
  out.push(
    exceptions.length
      ? exceptions
          .map((e) => `- Exception ${e.id}: ${e.item}, ${e.jira}, expires ${e.expires}`)
          .join("\n")
      : "- No exceptions",
  );
  out.push("");
}
console.log(out.join("\n"));
