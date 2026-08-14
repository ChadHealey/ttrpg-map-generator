import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

const stagedOutput = execFileSync(
  'git',
  ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
  { encoding: 'utf8' },
);

const stagedFiles = stagedOutput.split('\0').filter(Boolean);
const forbiddenDirectories = /(^|\/)(node_modules|dist|target|coverage)(\/|$)/u;
const forbiddenExtensions = /\.(log|pem|key|tmp)$/iu;
const forbiddenNames = new Set(['.DS_Store', 'id_dsa', 'id_ecdsa', 'id_ed25519', 'id_rsa']);

const violations = stagedFiles.filter((file) => {
  const fileName = basename(file);
  const isEnvironmentFile = fileName.startsWith('.env') && fileName !== '.env.example';
  const isUserProject = file.endsWith('.mapworld') && !file.startsWith('fixtures/');

  return (
    forbiddenDirectories.test(file) ||
    forbiddenExtensions.test(file) ||
    forbiddenNames.has(fileName) ||
    isEnvironmentFile ||
    isUserProject
  );
});

if (violations.length > 0) {
  console.error('Refusing to commit forbidden or machine-local files:');
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exitCode = 1;
}
