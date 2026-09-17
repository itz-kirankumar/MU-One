import type { PitchDraft } from '@/types/pitch';

/** Only explicit web URLs can become links, including drafts restored from storage. */
export function safePitchUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

// Escape raw input so an exported outline cannot inject HTML or Markdown links.
function plain(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#!|])/g, '\\$1');
}

export function pitchMarkdown(draft: PitchDraft): string {
  const input = draft.analyzedInput ?? draft.input;
  const result = draft.result;
  const lines = [
    `# ${plain(input.competition || 'Pitch preparation')}`,
    '',
    `Format: ${input.mode === 'case' ? 'Business case' : 'Venture pitch'}`,
    `Industry: ${plain(input.industry || 'Not specified')}`,
    `Round: ${plain(input.round || 'Not specified')}`,
    `Slide limit: ${input.slideLimit}`,
    `Deadline: ${plain(input.deadline || 'Not specified')}`,
    '', '## Working argument', plain(input.idea),
    '', '## Brief', plain(input.brief || 'Not supplied'),
    '', '## Rubric', plain(input.rubric || 'Not supplied'),
  ];
  if (!result) return lines.join('\n');
  lines.push('', '## Analysis', plain(result.summary), '', plain(result.recommendation),
    '', `Generated: ${plain(result.generatedAt)}`,
    `Research: ${result.researchStatus}. ${plain(result.researchNote)}`);
  for (const slide of result.slides) {
    lines.push('', `## Slide ${slide.number}: ${plain(slide.title)}`, plain(slide.keyMessage),
      ...slide.bullets.map((bullet) => `- ${plain(bullet)}`),
      '', `Judge's question: ${plain(slide.judgeQuestion)}`,
      `Source references: ${slide.sourceIds.map(plain).join(', ') || 'None'}`);
  }
  lines.push('', '## Weaknesses to resolve');
  for (const critique of result.critiques) {
    lines.push('', `### ${plain(critique.title)}`, plain(critique.issue),
      `Evidence needed: ${plain(critique.evidenceNeeded)}`, `Next action: ${plain(critique.actionTitle)}`);
  }
  lines.push('', '## Requirement coverage');
  for (const requirement of result.requirements) {
    lines.push(`- **${plain(requirement.criterion)}** (${requirement.coverage}): ${plain(requirement.feedback)}`);
  }
  lines.push('', '## Evidence and assumptions');
  for (const assumption of result.assumptions) {
    lines.push(`- **${assumption.kind}**: ${plain(assumption.claim)}`,
      `  Calculation: ${plain(assumption.calculation || 'Not supplied')}`,
      `  Source references: ${assumption.sourceIds.map(plain).join(', ') || 'None'}`);
  }
  lines.push('', '## Sources');
  for (const source of result.sources) {
    const url = safePitchUrl(source.url);
    lines.push(`- ${plain(source.id)}: ${plain(source.title)}${url ? ` — <${url.replace(/>/g, '%3E').replace(/</g, '%3C')}>` : ' (link unavailable)'}`,
      `  Retrieved: ${plain(source.retrievedAt)}`, `  ${plain(source.excerpt)}`);
  }
  return lines.join('\n');
}
