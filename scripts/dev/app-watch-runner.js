const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const distDir = path.join(repoRoot, 'dist');
const mainEntry = path.join(distDir, 'main.js');
const runtimeDir = path.join(repoRoot, '.codex-runtime');
const buildStatePath = path.join(runtimeDir, 'start-dev-build-state.json');

/**
 * @typedef {object} BuildState
 * @property {string} status
 * @property {number} generation
 */

/** @type {import('node:child_process').ChildProcess | null} */
let currentChild = null;
let shuttingDown = false;
let waitingForBuild = false;
let observedGeneration = -1;
let restartPendingGeneration = null;
let restartPendingReason = null;
let intentionalStopReason = null;
let restartInFlight = false;
/** @type {NodeJS.Timeout | null} */
let pollTimer = null;

const POLL_INTERVAL_MS = 500;
const RESTART_SETTLE_MS = 1000;
const REQUIRED_ENTRY_FILES = [
  path.join(distDir, 'main.js'),
  path.join(distDir, 'app.module.js'),
  path.join(distDir, 'app.controller.js'),
];

function now() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[app-watch ${now()}] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[app-watch ${now()}] ${message}\n`);
}

function readBuildState() {
  if (!fs.existsSync(buildStatePath)) {
    return null;
  }

  try {
    /** @type {unknown} */
    const parsed = JSON.parse(fs.readFileSync(buildStatePath, 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'status' in parsed &&
      typeof parsed.status === 'string' &&
      'generation' in parsed &&
      typeof parsed.generation === 'number'
    ) {
      return /** @type {BuildState} */ (parsed);
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to read build state: ${message}`);
    return null;
  }
}

function isBuildOutputReady() {
  return REQUIRED_ENTRY_FILES.every((filePath) => fs.existsSync(filePath));
}

function stopCurrentChild(reason) {
  if (!currentChild) {
    return false;
  }

  const child = currentChild;
  intentionalStopReason = reason;
  log(`Stopping app process ${child.pid} (${reason}).`);

  try {
    child.kill();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to stop app process ${child.pid}: ${message}`);
    intentionalStopReason = null;
  }

  return true;
}

function startChild() {
  if (restartInFlight && currentChild) {
    return;
  }

  const buildState = readBuildState();
  if (!buildState || buildState.status !== 'ready' || !isBuildOutputReady()) {
    if (!waitingForBuild) {
      waitingForBuild = true;
      log(`Waiting for build output: ${mainEntry}`);
    }
    return;
  }

  waitingForBuild = false;
  observedGeneration = Number.isFinite(buildState.generation)
    ? buildState.generation
    : observedGeneration;

  if (currentChild) {
    return;
  }

  const child = spawn(process.execPath, [mainEntry], {
    cwd: repoRoot,
    stdio: ['ignore', 'inherit', 'inherit'],
    windowsHide: true,
  });

  currentChild = child;
  restartInFlight = false;
  log(`Started app process ${child.pid}.`);

  child.on('exit', (code, signal) => {
    const exitedPid = child.pid;
    const expected = currentChild === child;
    const stopReason = intentionalStopReason;
    if (expected) {
      currentChild = null;
    }
    if (expected) {
      intentionalStopReason = null;
    }

    log(
      `App process ${exitedPid} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}.`,
    );

    if (
      !shuttingDown &&
      expected &&
      restartPendingGeneration !== null &&
      restartPendingReason
    ) {
      const pendingGeneration = restartPendingGeneration;
      restartPendingGeneration = null;
      restartPendingReason = null;
      observedGeneration = pendingGeneration;
      log(
        `App process ${exitedPid} fully stopped (${stopReason ?? 'planned-stop'}); starting generation ${pendingGeneration}.`,
      );
      setTimeout(() => {
        if (shuttingDown || currentChild) {
          return;
        }
        startChild();
      }, RESTART_SETTLE_MS);
      return;
    }

    if (!shuttingDown && expected && !stopReason) {
      scheduleRestart('app-exit');
    }
  });

  child.on('error', (error) => {
    const message =
      error instanceof Error ? error.stack || error.message : String(error);
    logError(`App process failed to start: ${message}`);
  });
}

function scheduleRestart(reason) {
  if (shuttingDown) {
    return;
  }

  log(`Scheduling restart (${reason}).`);
  setTimeout(() => {
    if (shuttingDown || currentChild) {
      return;
    }
    startChild();
  }, POLL_INTERVAL_MS);
}

function restartChild(reason) {
  log(`Restart requested (${reason}).`);
  const buildState = readBuildState();
  if (!buildState || buildState.status !== 'ready' || !isBuildOutputReady()) {
    if (!waitingForBuild) {
      waitingForBuild = true;
      log(`Waiting for stable build output before restart (${reason}).`);
    }
    return;
  }

  waitingForBuild = false;
  const targetGeneration = Number.isFinite(buildState.generation)
    ? buildState.generation
    : observedGeneration;

  if (!currentChild) {
    restartInFlight = false;
    observedGeneration = targetGeneration;
    startChild();
    return;
  }

  restartInFlight = true;
  restartPendingGeneration = targetGeneration;
  restartPendingReason = reason;
  if (!stopCurrentChild(reason)) {
    restartInFlight = false;
    observedGeneration = targetGeneration;
    restartPendingGeneration = null;
    restartPendingReason = null;
    startChild();
  }
}

function ensurePoller() {
  if (pollTimer) {
    return;
  }

  pollTimer = setInterval(() => {
    if (shuttingDown) {
      return;
    }

    const buildState = readBuildState();
    if (!buildState) {
      return;
    }

    const generation = Number.isFinite(buildState.generation)
      ? buildState.generation
      : null;

    if (buildState.status !== 'ready') {
      if (!waitingForBuild) {
        waitingForBuild = true;
        log(`Waiting for build state ready (${buildState.status}).`);
      }
      return;
    }

    if (
      restartInFlight ||
      restartPendingGeneration !== null ||
      intentionalStopReason
    ) {
      return;
    }

    if (!currentChild) {
      startChild();
      return;
    }

    if (generation !== null && generation > observedGeneration) {
      restartChild(`build-ready:${generation}`);
    }
  }, POLL_INTERVAL_MS);

  log(`Watching build state file: ${buildStatePath}`);
}

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  log(`Received ${signal}, shutting down watcher.`);

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }

  restartPendingGeneration = null;
  restartPendingReason = null;
  restartInFlight = false;
  stopCurrentChild(`signal:${signal}`);
  setTimeout(() => process.exit(0), 100);
}

function main() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(runtimeDir, { recursive: true });
  ensurePoller();
  startChild();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGHUP', () => shutdown('SIGHUP'));
process.on('uncaughtException', (error) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  logError(`Unhandled exception: ${message}`);
  process.exitCode = 1;
});

main();
