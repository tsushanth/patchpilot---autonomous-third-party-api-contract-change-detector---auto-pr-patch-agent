// Finds every line in an integration-code source file that references a
// given set of field names (as a property access, object-literal key, or
// string key), so PatchPilot can point at exactly what breaks.

export function findFieldNames(diff) {
  const names = new Set();
  for (const entry of diff.renamed) names.add(entry.from);
  for (const entry of diff.typeChanged) names.add(entry.key);
  for (const entry of diff.removed) names.add(entry.key);
  return [...names];
}

export function scanUsages(sourceContent, fieldNames) {
  const usages = [];
  const lines = sourceContent.split('\n');

  for (const field of fieldNames) {
    const pattern = new RegExp(`\\b${field}\\b`, 'g');
    lines.forEach((lineText, index) => {
      let match;
      while ((match = pattern.exec(lineText)) !== null) {
        usages.push({
          field,
          line: index + 1,
          column: match.index + 1,
          text: lineText.trim(),
        });
      }
    });
  }

  usages.sort((a, b) => a.line - b.line || a.column - b.column);
  return usages;
}
