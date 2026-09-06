// Fake integration code for a small SaaS billing module, wired to the
// Stripe "subscription" shape as it exists in the baseline (pre-change) schema.

export function normalizeSubscription(subscription) {
  return {
    id: subscription.id,
    planId: subscription.plan_id,
    status: subscription.status,
    quantity: subscription.quantity,
  };
}

export function calculateSeatCost(subscription, pricePerSeat) {
  return subscription.quantity * pricePerSeat;
}
