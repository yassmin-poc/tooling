// Compares the Nx preset's pins with the latest release tags. --write updates pins.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = 'packages/nx-plugin/src/generators/preset/pins.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const latest = (prefix) => {
  const re = new RegExp(`^${prefix}(\\d+\\.\\d+\\.\\d+)$`);
  return git('tag', '-l', `${prefix}*`, '--sort=-v:refname')
    .split('\n')
    .map((t) => t.match(re))
    .find(Boolean);
};

const pins = JSON.parse(readFileSync(FILE, 'utf8'));
const want = structuredClone(pins);
for (const [name, prefix] of [
  ['@yassmin-poc/commitlint-config', 'commitlint-config-v'],
  ['@yassmin-poc/standards', 'standards-v'],
]) {
  const m = latest(prefix);
  if (m) want.packages[name] = m[1];
}
const plugin = latest('poc-tools-v');
if (plugin) want.pluginRef = plugin[0];
const ci = latest('v');
if (ci) want.ciBase = { tag: ci[0], sha: git('rev-list', '-n', '1', ci[0]) };

const before = JSON.stringify(pins, null, 2) + '\n';
const after = JSON.stringify(want, null, 2) + '\n';
if (before === after) {
  console.log('Preset pins are current');
} else if (process.argv.includes('--write')) {
  writeFileSync(FILE, after);
  console.log('Preset pins updated');
} else {
  console.log('Preset pins lag behind the latest releases. Expected:\n' + after);
  process.exit(1);
}