import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSchema } from '../src/diffSchema.js';
import { explainChange } from '../src/explainChange.js';

const baseline = { id: 'sub_1', plan_id: 'plan_basic', status: 'active', quantity: 3 };

test('names the field, old/new shape, and vendor/endpoint for a breaking change', () => {
  const live = { id: 'sub_1', price_id: 'plan_basic', status: 'active', quantity: '3' };
  const diff = diffSchema(baseline, live);
  const explanation = explainChange(diff, { vendor: 'stripe', endpoint: 'subscription' });

  assert.match(explanation, /stripe subscription/);
  assert.match(explanation, /`plan_id`/);
  assert.match(explanation, /`price_id`/);
  assert.match(explanation, /`quantity`/);
  assert.match(explanation, /number/);
  assert.match(explanation, /string/);
});

test('reports a clean, no-breaking-change result plainly', () => {
  const live = { ...baseline, livemode: true };
  const diff = diffSchema(baseline, live);
  const explanation = explainChange(diff, { vendor: 'stripe-clean', endpoint: 'subscription' });

  assert.match(explanation, /No breaking changes detected/);
  assert.match(explanation, /`livemode`/);
});
