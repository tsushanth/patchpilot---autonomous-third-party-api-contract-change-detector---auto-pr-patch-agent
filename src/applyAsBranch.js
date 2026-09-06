// Materializes a PatchPilot fix as a local git branch + commit inside a copy
// of the "customer's" demo-repo, and writes the unified diff to disk as the
// artifact that would become a PR body. Standing in for an actual GitHub PR.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

export function applyAsBranch({ demoRepoSrcDir, workDir, branchName, commitMessage, patchedFiles, patchText, patchOutputPath }) {
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(workDir), { recursive: true });
  fs.cpSync(demoRepoSrcDir, workDir, { recursive: true });

  const gitEnv = ['-c', 'user.name=PatchPilot Bot', '-c', 'user.email=patchpilot@example.com'];

  git([...gitEnv, 'init', '--quiet'], workDir);
  git([...gitEnv, 'add', '-A'], workDir);
  git([...gitEnv, 'commit', '--quiet', '-m', 'Initial commit (pre-patch, baseline vendor schema)'], workDir);

  git([...gitEnv, 'checkout', '--quiet', '-b', branchName], workDir);

  for (const [relPath, content] of Object.entries(patchedFiles)) {
    const absPath = path.join(workDir, relPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content);
  }

  git([...gitEnv, 'add', '-A'], workDir);
  git([...gitEnv, 'commit', '--quiet', '-m', commitMessage], workDir);

  fs.mkdirSync(path.dirname(patchOutputPath), { recursive: true });
  fs.writeFileSync(patchOutputPath, patchText);

  return { workDir, branchName, patchOutputPath };
}
