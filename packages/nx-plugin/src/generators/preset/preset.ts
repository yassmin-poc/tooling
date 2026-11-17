import {
  Tree,
  formatFiles,
  generateFiles,
  addDependenciesToPackageJson,
  joinPathFragments,
} from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { PresetGeneratorSchema } from './schema';

const readJson = (p: string) =>
  JSON.parse(readFileSync(joinPathFragments(__dirname, p), 'utf8'));
// Pins of the other shared parts; preset-sync keeps them current.
const pins = readJson('pins.json');
// This package's own version, so the preset never pins an older nx-plugin.
const selfVersion: string = readJson('../../../package.json').version;

export async function presetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema,
) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', {
    ...options,
    dot: '.',
    toolingSha: pins.ciBase.sha,
    ciBaseTag: pins.ciBase.tag,
    pluginRef: pins.pluginRef,
  });
  const install = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@commitlint/cli': '21.2.4',
      ...pins.packages,
      '@yassmin-poc/nx-plugin': selfVersion,
    },
  );
  await formatFiles(tree);
  return install;
}

export default presetGenerator;
