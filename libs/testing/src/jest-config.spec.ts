import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import integrationConfig from '../../../jest.integration.config';

type JestPackageConfig = {
  jest: {
    testRegex: string;
    testPathIgnorePatterns: string[];
  };
};

const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf8'),
) as JestPackageConfig;

const rootTestRegex = new RegExp(packageJson.jest.testRegex);
const rootIgnorePatterns = packageJson.jest.testPathIgnorePatterns.map(
  (pattern) => new RegExp(pattern),
);
const integrationTestRegex = new RegExp(integrationConfig.testRegex as string);
const integrationRoots = (integrationConfig.roots ?? []).map((root) =>
  root.replace('<rootDir>/', ''),
);

function isMatchedByRootConfig(testPath: string): boolean {
  return (
    rootTestRegex.test(testPath) &&
    !rootIgnorePatterns.some((pattern) => pattern.test(testPath))
  );
}

function isMatchedByIntegrationConfig(testPath: string): boolean {
  const isUnderIntegrationRoot = integrationRoots.some((root) =>
    testPath.startsWith(root),
  );

  return integrationTestRegex.test(testPath) && isUnderIntegrationRoot;
}

describe('Jest test discovery config', () => {
  it('keeps the hyphenated ONNX spec reachable from the root config', () => {
    const onnxSpecPath =
      'apps/analysis/src/services/bert-sentiment-integration.spec.ts';

    expect(isMatchedByRootConfig(onnxSpecPath)).toBe(true);
    expect(isMatchedByIntegrationConfig(onnxSpecPath)).toBe(false);
  });

  it('routes dot-separated integration specs to the integration config', () => {
    const repositoryIntegrationPath =
      'libs/database/src/test/smoke.integration.spec.ts';

    expect(isMatchedByRootConfig(repositoryIntegrationPath)).toBe(false);
    expect(isMatchedByIntegrationConfig(repositoryIntegrationPath)).toBe(true);
  });
});
