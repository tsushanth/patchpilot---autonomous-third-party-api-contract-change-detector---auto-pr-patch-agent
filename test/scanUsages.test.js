import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFieldNames, scanUsages } from '../src/scanUsages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const billingSource = fs.readFileSync(
  path.join(__dirname, '..', 'fixtures', 'demo-repo', 'src', 'billing.js'),
  'utf8'
);

test('finds every line referencing a changed field', () => {
  const usages = scanUsages(billingSource, ['plan_id', 'quantity']);
  const lines = usages.map((u) => u.line);
  assert.equal(usages.filter((u) => u.field === 'plan_id').length, 1);
  // 3 raw references: the `quantity:` object-literal key plus two
  // `subscription.quantity` reads (normalizeSubscription + calculateSeatCost).
  assert.equal(usages.filter((u) => u.field === 'quantity').length, 3);
  assert.deepEqual(lines, [...lines].sort((a, b) => a - b));
});

test('does not match field names that are substrings of other identifiers', () => {
  const source = "const planIdMapping = subscription.plan_id;\n";
  const usages = scanUsages(source, ['plan_id']);
  assert.equal(usages.length, 1);
  assert.equal(usages[0].text.includes('subscription.plan_id'), true);
});

test('findFieldNames collects renamed, type-changed, and removed keys', () => {
  const diff = {
    renamed: [{ from: 'plan_id', to: 'price_id', value: 'x' }],
    typeChanged: [{ key: 'quantity', oldType: 'number', newType: 'string' }],
    removed: [{ key: 'status', value: 'active' }],
    added: [],
  };
  assert.deepEqual(findFieldNames(diff).sort(), ['plan_id', 'quantity', 'status']);
});
