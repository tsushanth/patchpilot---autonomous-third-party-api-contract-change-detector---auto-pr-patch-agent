#!/usr/bin/env node
// CLI entry point: `node bin/patchpilot.js run --vendor stripe`

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { diffSchema } from '../src/diffSchema.js';
import { findFieldNames, scanUsages } from '../src/scanUsages.js';
import { generatePatch, unifiedDiff } from '../src/generatePatch.js';
import { explainChange } from '../src/explainChange.js';
import { applyAsBranch } from '../src/applyAsBranch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ENDPOINT = 'subscription';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--vendor') options.vendor = rest[++i];
  }
  return { command, options };
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function run(vendor) {
  const vendorDir = path.join(ROOT, 'fixtures', 'vendor');
  const baselinePath = path.join(vendorDir, `${vendor}.${ENDPOINT}.baseline.json`);
  const livePath = path.join(vendorDir, `${vendor}.${ENDPOINT}.live.json`);

  if (!fs.existsSync(baselinePath) || !fs.existsSync(livePath)) {
    console.error(`No vendor fixtures found for "${vendor}" (expected ${baselinePath}).`);
    process.exitCode = 1;
    return;
  }

  const baseline = readJSON(baselinePath);
  const live = readJSON(livePath);
  const diff = diffSchema(baseline, live);

  console.log(explainChange(diff, { vendor, endpoint: ENDPOINT }));

  if (!diff.hasBreakingChanges) {
    return;
  }

  const demoRepoSrcDir = path.join(ROOT, 'fixtures', 'demo-repo');
  const sourceRelPath = 'src/billing.js';
  const testRelPath = 'test/billing.test.js';

  const sourceContent = fs.readFileSync(path.join(demoRepoSrcDir, sourceRelPath), 'utf8');
  const testContent = fs.readFileSync(path.join(demoRepoSrcDir, testRelPath), 'utf8');

  const fieldNames = findFieldNames(diff);
  const usages = scanUsages(sourceContent, fieldNames);

  console.log(`\nUsages found in ${sourceRelPath}:`);
  for (const usage of usages) {
    console.log(`  ${sourceRelPath}:${usage.line}:${usage.column}  ${usage.text}`);
  }

  const { patchedSource, patchedTest } = generatePatch({ sourceContent, testContent, diff });

  const sourceDiff = unifiedDiff(sourceContent, patchedSource, { oldPath: sourceRelPath, newPath: sourceRelPath });
  const testDiff = unifiedDiff(testContent, patchedTest, { oldPath: testRelPath, newPath: testRelPath });
  const patchText = sourceDiff + testDiff;

  console.log('\n--- Generated patch ---\n');
  console.log(patchText);

  const branchName = `patchpilot/${vendor}-${ENDPOINT}-fix`;
  const workDir = path.join(ROOT, 'fixtures', 'demo-repo-patched', vendor);
  const patchOutputPath = path.join(ROOT, 'fixtures', 'demo-repo-patched', `${vendor}-${ENDPOINT}-fix.patch`);

  const result = applyAsBranch({
    demoRepoSrcDir,
    workDir,
    branchName,
    commitMessage: `Fix: adapt to ${vendor} ${ENDPOINT} schema change\n\n${explainChange(diff, { vendor, endpoint: ENDPOINT })}`,
    patchedFiles: {
      [sourceRelPath]: patchedSource,
      [testRelPath]: patchedTest,
    },
    patchText,
    patchOutputPath,
  });

  console.log(`Created branch "${result.branchName}" and committed the patch in ${result.workDir}`);
  console.log(`Patch written to ${result.patchOutputPath}`);

  console.log('\nRunning tests against the patched repo...');
  try {
    execFileSync('node', ['--test'], { cwd: workDir, stdio: 'inherit' });
    console.log('\nTests passed against the patched code.');
  } catch {
    console.error('\nTests FAILED against the patched code.');
    process.exitCode = 1;
  }
}

const { command, options } = parseArgs(process.argv.slice(2));

if (command !== 'run' || !options.vendor) {
  console.error('Usage: node bin/patchpilot.js run --vendor <vendor>');
  process.exitCode = 1;
} else {
  run(options.vendor);
}
