// Structural diff between two flat JSON samples (a "baseline" PatchPilot has
// on file for a vendor endpoint, and a "live" response just observed).
//
// Detects:
//  - renamed fields: a baseline key disappears and a live key with the same
//    value appears in its place
//  - type changes: a key survives in both but its JS typeof differs
//  - removed fields: a baseline key disappears with no matching live value
//  - added fields: a live key has no baseline counterpart (informational —
//    additive changes are not breaking)

function typeOf(value) {
  return Array.isArray(value) ? 'array' : typeof value;
}

export function diffSchema(baseline, live) {
  const baselineKeys = new Set(Object.keys(baseline));
  const liveKeys = new Set(Object.keys(live));

  const onlyInBaseline = [...baselineKeys].filter((key) => !liveKeys.has(key));
  const onlyInLive = [...liveKeys].filter((key) => !baselineKeys.has(key));
  const inBoth = [...baselineKeys].filter((key) => liveKeys.has(key));

  const renamed = [];
  const removed = [];
  const usedLiveKeys = new Set();

  for (const oldKey of onlyInBaseline) {
    const baselineValue = baseline[oldKey];
    const candidate = onlyInLive.find(
      (newKey) => !usedLiveKeys.has(newKey) && live[newKey] === baselineValue
    );
    if (candidate) {
      usedLiveKeys.add(candidate);
      renamed.push({ from: oldKey, to: candidate, value: baselineValue });
    } else {
      removed.push({ key: oldKey, value: baselineValue });
    }
  }

  const added = onlyInLive
    .filter((key) => !usedLiveKeys.has(key))
    .map((key) => ({ key, value: live[key] }));

  const typeChanged = inBoth
    .map((key) => ({
      key,
      oldType: typeOf(baseline[key]),
      newType: typeOf(live[key]),
      oldValue: baseline[key],
      newValue: live[key],
    }))
    .filter((entry) => entry.oldType !== entry.newType);

  const hasBreakingChanges = renamed.length > 0 || removed.length > 0 || typeChanged.length > 0;

  return { renamed, removed, added, typeChanged, hasBreakingChanges };
}
