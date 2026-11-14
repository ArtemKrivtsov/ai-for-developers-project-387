import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function summarize(report) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-'));
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report));
  execFileSync(process.execPath, [join(here, 'summarize.mjs'), join(dir, 'report.json'), dir]);
  return {
    json: JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')),
    md: readFileSync(join(dir, 'summary.md'), 'utf8'),
  };
}

const category = (id, score, refs) => ({ id, title: id, score, auditRefs: refs });
const audit = (id, score, mode = 'binary') => ({ id, title: id, score, scoreDisplayMode: mode });

test('a weighted core audit below 90 is a finding with a stable fingerprint', () => {
  const { json } = summarize({
    categories: { seo: category('seo', 0.82, [{ id: 'meta-description', weight: 1 }]) },
    audits: { 'meta-description': audit('meta-description', 0) },
  });
  assert.deepEqual(
    json.findings.map((f) => f.fingerprint),
    ['lighthouse:meta-description'],
  );
});

test('audits without weight or outside the core categories are not findings', () => {
  const { json, md } = summarize({
    categories: {
      performance: category('performance', 1, [
        { id: 'network-dependency-tree-insight', weight: 0 },
      ]),
      'agentic-browsing': category('agentic-browsing', 0.5, [{ id: 'llms-txt', weight: 1 }]),
    },
    audits: {
      'network-dependency-tree-insight': audit('network-dependency-tree-insight', 0),
      'llms-txt': audit('llms-txt', 0),
    },
  });
  assert.deepEqual(json.findings, []);
  assert.match(md, /Находок нет\./);
});

test('a score of exactly 90 is not a finding, 89 is', () => {
  const refs = [
    { id: 'a', weight: 1 },
    { id: 'b', weight: 1 },
  ];
  const { json } = summarize({
    categories: { performance: category('performance', 0.9, refs) },
    audits: { a: audit('a', 0.9, 'numeric'), b: audit('b', 0.89, 'numeric') },
  });
  assert.deepEqual(
    json.findings.map((f) => f.id),
    ['b'],
  );
});

test('the training report is marked as training and keeps its prepared finding', () => {
  const report = JSON.parse(readFileSync(join(here, 'fixtures/training-report.json'), 'utf8'));
  const { json, md } = summarize(report);
  assert.equal(json.training, true);
  assert.deepEqual(
    json.findings.map((f) => f.fingerprint),
    ['training:render-blocking-resources'],
  );
  assert.match(md, /УЧЕБНЫЙ/);
});
