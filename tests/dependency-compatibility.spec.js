import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('Mammoth CLI conversion remains compatible with the parser override', () => {
  const output = execFileSync(process.execPath, [
    'node_modules/mammoth/bin/mammoth',
    'tests/fixtures/import.docx',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  expect(output).toContain('<p>Imported test document</p>');
});
