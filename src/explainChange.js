// Turns a structural diff into a plain-English explanation, the kind of
// paragraph that would become a PR description.

export function explainChange(diff, { vendor, endpoint }) {
  if (!diff.hasBreakingChanges) {
    const lines = [`No breaking changes detected for ${vendor} ${endpoint}.`];
    for (const { key, value } of diff.added) {
      lines.push(`  (info) New field \`${key}\` = ${JSON.stringify(value)} was added — non-breaking, no patch needed.`);
    }
    return lines.join('\n');
  }

  const lines = [`PatchPilot detected a breaking change in the ${vendor} ${endpoint} API:`, ''];

  for (const { from, to, value } of diff.renamed) {
    lines.push(
      `- Field renamed: \`${from}\` -> \`${to}\` (same value ${JSON.stringify(value)}). ` +
        `Code reading \`${from}\` will now get \`undefined\`.`
    );
  }

  for (const { key, oldType, newType, oldValue, newValue } of diff.typeChanged) {
    lines.push(
      `- Type changed: \`${key}\` changed from ${oldType} (e.g. ${JSON.stringify(oldValue)}) to ` +
        `${newType} (e.g. ${JSON.stringify(newValue)}). Arithmetic/comparisons assuming the old type will misbehave.`
    );
  }

  for (const { key, value } of diff.removed) {
    lines.push(`- Field removed: \`${key}\` (was ${JSON.stringify(value)}) is no longer present in the response.`);
  }

  if (diff.added.length > 0) {
    lines.push('', 'Non-breaking additions (informational only, no patch needed):');
    for (const { key, value } of diff.added) {
      lines.push(`  - New field \`${key}\` = ${JSON.stringify(value)}`);
    }
  }

  return lines.join('\n');
}
