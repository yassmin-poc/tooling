import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { presetGenerator } from './preset';
import { readFileSync } from 'node:fs';
const pins = JSON.parse(readFileSync(`${__dirname}/pins.json`, 'utf8'));

describe('preset generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('writes the pinned plugin ref and CI version', async () => {
    await presetGenerator(tree, { name: 'test' });
    const settings = JSON.parse(tree.read('.claude/settings.json', 'utf-8')!);
    expect(
      settings.extraKnownMarketplaces['yassmin-poc-tools'].source.ref,
    ).toBe(pins.pluginRef);
    const ci = tree.read('.github/workflows/ci.yml', 'utf-8')!;
    expect(ci).toContain(`ci-base.yml@${pins.ciBase.sha} # ${pins.ciBase.tag}`);
  });
});
