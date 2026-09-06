import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSubscription, calculateSeatCost } from '../src/billing.js';

test('normalizeSubscription maps plan_id to planId', () => {
  const subscription = {
    id: 'sub_1N2v3C',
    plan_id: 'plan_basic_monthly',
    status: 'active',
    quantity: 3,
  };
  const normalized = normalizeSubscription(subscription);
  assert.equal(normalized.planId, 'plan_basic_monthly');
  assert.equal(normalized.quantity, 3);
});

test('calculateSeatCost multiplies quantity by price per seat', () => {
  const subscription = { quantity: 3 };
  assert.equal(calculateSeatCost(subscription, 10), 30);
});
