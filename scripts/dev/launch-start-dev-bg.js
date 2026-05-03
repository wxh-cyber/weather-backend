const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function openLog(pathname) {
  return fs.openSync(pathname, 'a');
}

function spawnDetached(command, args, cwd, stdoutPath, stderrPath) {
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ['ignore', openLog(stdoutPath), openLog(stderrPath)],
    windowsHide: true,
  });
  child.unref();
  return child;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const runtimeDir = path.join(repoRoot, '.codex-runtime');
  const launchConfigPath = path.join(runtimeDir, 'start-dev-bg.launch.json');

  if (!fs.existsSync(launchConfigPath)) {
    throw new Error(`Launch config not found: ${launchConfigPath}`);
  }

  const launchConfigText = fs
    .readFileSync(launchConfigPath, 'utf8')
    .replace(/^\uFEFF/, '');
  const launchConfig = JSON.parse(launchConfigText);

  const nestCliPath = path.join(
    repoRoot,
    'node_modules',
    '@nestjs',
    'cli',
    'bin',
    'nest.js',
  );
  const buildStdoutPath = path.join(runtimeDir, 'start-dev-build.stdout.log');
  const buildStderrPath = path.join(runtimeDir, 'start-dev-build.stderr.log');
  const appStdoutPath = path.join(runtimeDir, 'start-dev-app.stdout.log');
  const appStderrPath = path.join(runtimeDir, 'start-dev-app.stderr.log');
  const sessionPath = path.join(runtimeDir, 'start-dev-bg.session.json');

  const buildWatch = spawnDetached(
    process.execPath,
    [nestCliPath, 'build', '--watch'],
    repoRoot,
    buildStdoutPath,
    buildStderrPath,
  );

  const appWatch = spawnDetached(
    process.execPath,
    [path.join('scripts', 'dev', 'app-watch-runner.js')],
    repoRoot,
    appStdoutPath,
    appStderrPath,
  );

  const session = {
    launcherPid: process.pid,
    buildWatchPid: buildWatch.pid,
    appWatchPid: appWatch.pid,
    preExistingPorts: Array.isArray(launchConfig.preExistingPorts)
      ? launchConfig.preExistingPorts
      : [],
    basePort: Number(launchConfig.basePort),
    maxPort: Number(launchConfig.maxPort),
    buildStdoutPath,
    buildStderrPath,
    appStdoutPath,
    appStderrPath,
    startedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    sessionPath,
    `${JSON.stringify(session, null, 2)}\n`,
    'utf8',
  );
  fs.rmSync(launchConfigPath, { force: true });
}

try {
  main();
} catch (error) {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const runtimeDir = path.join(repoRoot, '.codex-runtime');
  const stderrPath = path.join(runtimeDir, 'start-dev-app.stderr.log');
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  fs.appendFileSync(stderrPath, `${message}\n`, 'utf8');
  process.exitCode = 1;
}
