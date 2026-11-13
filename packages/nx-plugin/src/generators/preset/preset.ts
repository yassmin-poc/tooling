import {
  Tree,
  formatFiles,
  generateFiles,
  addDependenciesToPackageJson,
  joinPathFragments,
} from '@nx/devkit';
import { PresetGeneratorSchema } from './schema';

const TOOLING_SHA = 'feca98ae97ea3353ea6f7b179e71d83fb1566b10';

export async function presetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema,
) {
  generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', {
    ...options,
    dot: '.',
    toolingSha: TOOLING_SHA,
  });
  const install = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@commitlint/cli': '21.2.4',
      '@yassmin-poc/commitlint-config': '0.1.0',
      '@yassmin-poc/standards': '0.1.0',
      '@yassmin-poc/nx-plugin': '0.1.0',
    },
  );
  await formatFiles(tree);
  return install;
}

export default presetGenerator;
