import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSchema } from '../src/diffSchema.js';

const baseline = {
  id: 'sub_1',
  customer: 'cus_1',
  plan_id: 'plan_basic',
  status: 'active',
  quantity: 3,
};

test('detects a renamed field with the same value', () => {
  const live = { ...baseline, price_id: 'plan_basic' };
  delete live.plan_id;
  const diff = diffSchema(baseline, live);
  assert.deepEqual(diff.renamed, [{ from: 'plan_id', to: 'price_id', value: 'plan_basic' }]);
  assert.equal(diff.hasBreakingChanges, true);
});

test('detects a type change on a surviving field', () => {
  const live = { ...baseline, quantity: '3' };
  const diff = diffSchema(baseline, live);
  assert.deepEqual(diff.typeChanged, [
    { key: 'quantity', oldType: 'number', newType: 'string', oldValue: 3, newValue: '3' },
  ]);
  assert.equal(diff.hasBreakingChanges, true);
});

test('flags a purely additive field as info, not breaking', () => {
  const live = { ...baseline, livemode: true };
  const diff = diffSchema(baseline, live);
  assert.deepEqual(diff.added, [{ key: 'livemode', value: true }]);
  assert.equal(diff.renamed.length, 0);
  assert.equal(diff.typeChanged.length, 0);
  assert.equal(diff.hasBreakingChanges, false);
});

test('identical schemas produce no changes at all', () => {
  const live = { ...baseline };
  const diff = diffSchema(baseline, live);
  assert.deepEqual(diff, { renamed: [], removed: [], added: [], typeChanged: [], hasBreakingChanges: false });
});

test('detects a removed field with no rename candidate', () => {
  const live = { ...baseline };
  delete live.status;
  const diff = diffSchema(baseline, live);
  assert.deepEqual(diff.removed, [{ key: 'status', value: 'active' }]);
  assert.equal(diff.hasBreakingChanges, true);
});
