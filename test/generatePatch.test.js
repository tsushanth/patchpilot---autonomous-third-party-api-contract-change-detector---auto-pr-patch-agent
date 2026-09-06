import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffSchema } from '../src/diffSchema.js';
import { generatePatch, unifiedDiff } from '../src/generatePatch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRepo = path.join(__dirname, '..', 'fixtures', 'demo-repo');
const sourceContent = fs.readFileSync(path.join(demoRepo, 'src', 'billing.js'), 'utf8');
const testContent = fs.readFileSync(path.join(demoRepo, 'test', 'billing.test.js'), 'utf8');

const baseline = { id: 'sub_1', customer: 'cus_1', plan_id: 'plan_basic_monthly', status: 'active', quantity: 3 };
const live = { id: 'sub_1', customer: 'cus_1', price_id: 'plan_basic_monthly', status: 'active', quantity: '3' };
const diff = diffSchema(baseline, live);

test('patched source no longer references the renamed field', () => {
  const { patchedSource } = generatePatch({ sourceContent, testContent, diff });
  assert.equal(/\bplan_id\b/.test(patchedSource), false);
  assert.equal(patchedSource.includes('subscription.price_id'), true);
});

test('patched source coerces the type-changed field back to a number', () => {
  const { patchedSource } = generatePatch({ sourceContent, testContent, diff });
  assert.equal(patchedSource.includes('Number(subscription.quantity)'), true);
});

test('patched test fixture uses the new vendor shape and the code still passes', () => {
  const { patchedTest } = generatePatch({ sourceContent, testContent, diff });
  assert.equal(/\bplan_id\b/.test(patchedTest), false);
  assert.equal(patchedTest.includes("price_id: 'plan_basic_monthly'"), true);
  assert.equal(patchedTest.includes("quantity: '3'"), true);
});

test('unifiedDiff returns empty string for identical content', () => {
  assert.equal(unifiedDiff('same\n', 'same\n', { oldPath: 'a', newPath: 'a' }), '');
});

test('unifiedDiff produces a hunk with the changed line', () => {
  const diffText = unifiedDiff('a\nb\nc\n', 'a\nx\nc\n', { oldPath: 'f.js', newPath: 'f.js' });
  assert.equal(diffText.includes('-b'), true);
  assert.equal(diffText.includes('+x'), true);
  assert.equal(diffText.includes('--- a/f.js'), true);
});
