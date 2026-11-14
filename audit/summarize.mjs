// Turns a Lighthouse JSON report into the short summary the audit agent reads.
// Usage: node audit/summarize.mjs <report.json> <out-dir>
// Writes summary.json (machine-readable findings) and summary.md (for people and the agent).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [reportPath, outDir] = process.argv.slice(2);
if (!reportPath || !outDir) {
  console.error('usage: node audit/summarize.mjs <report.json> <out-dir>');
  process.exit(2);
}

const report = JSON.parse(readFileSync(reportPath, 'utf8'));
// A training report is a prepared fixture with a known finding, never a real defect.
const training = report.training === true;
// Below this score an audit counts as a finding.
const threshold = 0.9;

const categories = Object.values(report.categories ?? {})
  .filter(({ id }) => ['performance', 'accessibility', 'best-practices', 'seo'].includes(id))
  .map(({ id, title, score }) => ({
    id,
    title,
    score: score === null ? null : Math.round(score * 100),
  }));

// Only audits that count towards the four core categories: an audit with zero weight or
// from an experimental category is information, not a problem to file.
const core = new Set(['performance', 'accessibility', 'best-practices', 'seo']);
const weighted = new Set(
  Object.values(report.categories ?? {})
    .filter(({ id }) => core.has(id))
    .flatMap(({ auditRefs = [] }) =>
      auditRefs.filter(({ weight }) => weight > 0).map(({ id }) => id),
    ),
);
const counts = (id) => training || weighted.has(id);

const findings = Object.values(report.audits ?? {})
  .filter(
    ({ id, score, scoreDisplayMode }) =>
      counts(id) &&
      (scoreDisplayMode === 'numeric' || scoreDisplayMode === 'binary') &&
      score !== null &&
      score < threshold,
  )
  .map(({ id, title, score, displayValue }) => ({
    // A stable key of the problem: the agent looks for it in existing issues.
    fingerprint: `${training ? 'training' : 'lighthouse'}:${id}`,
    id,
    title,
    score: Math.round(score * 100),
    displayValue: displayValue ?? '',
  }))
  .sort((a, b) => a.score - b.score);

const summary = {
  training,
  url: report.finalDisplayedUrl ?? report.finalUrl ?? report.requestedUrl,
  fetchTime: report.fetchTime,
  lighthouseVersion: report.lighthouseVersion,
  threshold: Math.round(threshold * 100),
  categories,
  findings,
};
writeFileSync(join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const lines = [
  training
    ? '# УЧЕБНЫЙ отчёт аудита (подготовленные данные, не дефект приложения)'
    : '# Отчёт аудита',
  '',
  `- Страница: ${summary.url}`,
  `- Время проверки: ${summary.fetchTime}`,
  `- Lighthouse: ${summary.lighthouseVersion}`,
  '',
  '## Категории',
  '',
  ...categories.map(({ title, score }) => `- ${title}: ${score ?? 'нет данных'}`),
  '',
  `## Находки (оценка ниже ${summary.threshold})`,
  '',
  ...(findings.length === 0
    ? ['Находок нет.']
    : findings.map(
        ({ fingerprint, title, score, displayValue }) =>
          `- \`${fingerprint}\` ${title}: ${score}${displayValue ? ` (${displayValue})` : ''}`,
      )),
  '',
];
writeFileSync(join(outDir, 'summary.md'), lines.join('\n'));
console.log(lines.join('\n'));
