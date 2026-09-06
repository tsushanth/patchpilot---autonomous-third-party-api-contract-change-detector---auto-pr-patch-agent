// Turns a schema diff into edited file contents.
//
// Two kinds of transform, both driven generically by the diff (not
// hardcoded to "plan_id" or "quantity" specifically):
//
//  1. Renamed field: every occurrence of the old field name as a bare
//     identifier (property access, object-literal key, quoted key) is
//     replaced with the new field name.
//
//  2. Type-changed field: every read of the field is coerced back to the
//     type the code was written against, using the matching JS coercion
//     function (Number/String/Boolean). This is a generic, safe strategy
//     for "the value's JS type changed but the code still needs the old
//     type" — it doesn't require knowing *why* the vendor changed the type.
//     Object-literal fixtures in test files are additionally rewritten to
//     use a same-value literal of the *new* type, so tests exercise the
//     actual new shape rather than the stale one.

const COERCE_FN = { number: 'Number', string: 'String', boolean: 'Boolean' };

function renameField(content, from, to) {
  const pattern = new RegExp(`\\b${from}\\b`, 'g');
  return content.replace(pattern, to);
}

function coerceReads(content, field, oldType) {
  const coerceFn = COERCE_FN[oldType];
  if (!coerceFn) return content;
  // Match `<identifier>.field` reads not already wrapped in the coercion call.
  const pattern = new RegExp(`(?<!${coerceFn}\\()\\b(\\w+)\\.${field}\\b`, 'g');
  return content.replace(pattern, `${coerceFn}($1.${field})`);
}

function relitTestFixtures(content, field, oldType, newType) {
  if (oldType === 'number' && newType === 'string') {
    const pattern = new RegExp(`${field}:\\s*(-?\\d+(?:\\.\\d+)?)`, 'g');
    return content.replace(pattern, `${field}: '$1'`);
  }
  if (oldType === 'string' && newType === 'number') {
    const pattern = new RegExp(`${field}:\\s*'(-?\\d+(?:\\.\\d+)?)'`, 'g');
    return content.replace(pattern, `${field}: $1`);
  }
  return content;
}

export function generatePatch({ sourceContent, testContent, diff }) {
  let patchedSource = sourceContent;
  let patchedTest = testContent;

  for (const { from, to } of diff.renamed) {
    patchedSource = renameField(patchedSource, from, to);
    patchedTest = renameField(patchedTest, from, to);
  }

  for (const { key, oldType, newType } of diff.typeChanged) {
    patchedSource = coerceReads(patchedSource, key, oldType);
    patchedTest = relitTestFixtures(patchedTest, key, oldType, newType);
  }

  return { patchedSource, patchedTest };
}

// Minimal unified-diff generator (line-based longest-common-subsequence),
// good enough for small fixture files and readable PR-body output.
export function unifiedDiff(oldContent, newContent, { oldPath, newPath }) {
  const a = oldContent.split('\n');
  const b = newContent.split('\n');

  const lcs = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ type: 'ctx', line: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', line: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', line: b[j] });
      j++;
    }
  }
  while (i < a.length) ops.push({ type: 'del', line: a[i++] });
  while (j < b.length) ops.push({ type: 'add', line: b[j++] });

  if (!ops.some((op) => op.type !== 'ctx')) return '';

  const header = [`--- a/${oldPath}`, `+++ b/${newPath}`];
  const oldCount = ops.filter((op) => op.type !== 'add').length;
  const newCount = ops.filter((op) => op.type !== 'del').length;
  const hunkHeader = `@@ -1,${oldCount} +1,${newCount} @@`;
  const body = ops.map((op) => {
    if (op.type === 'ctx') return ` ${op.line}`;
    if (op.type === 'del') return `-${op.line}`;
    return `+${op.line}`;
  });

  return [...header, hunkHeader, ...body].join('\n') + '\n';
}
