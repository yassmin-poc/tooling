import { Tree, formatFiles } from '@nx/devkit';

export default async function update(tree: Tree) {
  if (!tree.exists('CONTRIBUTING.md')) {
    tree.write(
      'CONTRIBUTING.md',
      '# Contributing\n\nDummy file added by the 0.2.0 migration.\n',
    );
  }
  await formatFiles(tree);
}
