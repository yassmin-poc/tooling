import {
  Tree,
  formatFiles,
  generateFiles,
  addDependenciesToPackageJson,
  joinPathFragments,
} from '@nx/devkit';
import { PresetGeneratorSchema } from './schema';

const TOOLING_SHA = 'REPLACE_IN_STEP_19';

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
