import type { CheckpointResult } from '@/types/checkpoint';

// Deck text is untrusted input. Escape it so an exported report cannot smuggle
// HTML or Markdown links into whatever the student pastes it into.
function plain(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/([\\`*_{}[\]()#!|])/g, '\\$1');
}

const refs = (slideRefs: number[]) => (slideRefs.length ? ` (slide ${slideRefs.join(', ')})` : '');

export function checkpointMarkdown(result: CheckpointResult, problemStatement: string): string {
  const lines = [
    `# Pitch Checkpoint — ${plain(result.deckSummary.fileName)}`,
    '',
    `**Score: ${result.totalAwarded} / ${result.totalPossible} (${result.percentage}%) — ${result.band}**`,
    '',
    `Graded ${plain(result.gradedAt)} · model ${plain(result.model)} · ${result.deckSummary.slideCount} ${result.deckSummary.format === 'pdf' ? 'pages' : 'slides'} · ${result.deckSummary.wordCount} words read`,
    '',
    '## Verdict',
    plain(result.verdictSummary),
    '',
    '## Problem statement graded against',
    plain(problemStatement),
    '',
    '## Measured checks',
    '',
    '| Check | Value | Status |',
    '| --- | --- | --- |',
    ...result.measurements.map((item) => `| ${plain(item.label)} | ${plain(item.value)} | ${item.status} |`),
    '',
    '## Scorecard',
    '',
    '| Criterion | Awarded | Weight | Verdict |',
    '| --- | --- | --- | --- |',
    ...result.scores.map((score) => `| ${plain(score.label)} | ${score.awarded} | ${score.weight} | ${score.verdict} |`),
    `| **Total** | **${result.totalAwarded}** | **${result.totalPossible}** | **${result.band}** |`,
    '',
    '## Criterion detail',
  ];

  for (const score of result.scores) {
    lines.push(
      '',
      `### ${plain(score.label)} — ${score.awarded}/${score.weight} (${score.verdict})`,
      `Evidence${refs(score.slideRefs)}: ${plain(score.evidence)}`,
      '',
      plain(score.reasoning),
      '',
      `Fix: ${plain(score.fix)}`
    );
  }

  lines.push('', '## Flaws found');
  for (const flaw of result.flaws) {
    lines.push(
      '',
      `### [${flaw.severity}] ${plain(flaw.title)}${refs(flaw.slideRefs)}`,
      plain(flaw.whatIsWrong),
      '',
      `Why it costs marks: ${plain(flaw.whyJudgesPenalise)}`,
      `Fix: ${plain(flaw.fix)}`
    );
  }

  lines.push('', '## Questions to prepare for');
  for (const question of result.judgeQuestions) lines.push(`- ${plain(question)}`);

  lines.push('', '## Fit to the brief', plain(result.alignment.note), '', '**Covered**');
  for (const item of result.alignment.covered) lines.push(`- ${plain(item)}`);
  lines.push('', '**Missed**');
  for (const item of result.alignment.missed) lines.push(`- ${plain(item)}`);

  lines.push('', '## Read this grade with care');
  for (const caveat of result.caveats) lines.push(`- ${plain(caveat)}`);

  return lines.join('\n');
}

export function downloadCheckpoint(result: CheckpointResult, problemStatement: string) {
  const blob = new Blob([checkpointMarkdown(result, problemStatement)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pitch-checkpoint-${result.gradedAt.slice(0, 10)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
