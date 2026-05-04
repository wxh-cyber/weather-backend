const fs = require('node:fs');
const http = require('node:http');
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
let startInFlight = false;
let lastPortStateSignature = null;
/** @type {NodeJS.Timeout | null} */
let pollTimer = null;

const POLL_INTERVAL_MS = 500;
const RESTART_SETTLE_MS = 1000;
const REQUIRED_ENTRY_FILES = [
  path.join(distDir, 'main.js'),
  path.join(distDir, 'app.module.js'),
  path.join(distDir, 'app.controller.js'),
];
const DEFAULT_BASE_PORT = 3000;
const DEFAULT_MAX_PORT = 3005;
const HEALTH_CHECK_TIMEOUT_MS = 600;

function now() {
  return new Date().toISOString();
}

function log(message) {
  process.stdout.write(`[app-watch ${now()}] ${message}\n`);
}

function logError(message) {
  process.stderr.write(`[app-watch ${now()}] ${message}\n`);
}

function readSession() {
  const sessionPath = path.join(runtimeDir, 'start-dev-bg.session.json');
  if (!fs.existsSync(sessionPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to read session file: ${message}`);
    return null;
  }
}

function getPortRange() {
  const session = readSession();
  const basePort = Number.isFinite(Number(session?.basePort))
    ? Number(session.basePort)
    : DEFAULT_BASE_PORT;
  const maxPort = Number.isFinite(Number(session?.maxPort))
    ? Number(session.maxPort)
    : DEFAULT_MAX_PORT;
  return {
    basePort,
    maxPort: Math.max(basePort, maxPort),
  };
}

function isHealthyRootResponse(statusCode, body) {
  if (statusCode !== 200) {
    return false;
  }

  try {
    const payload = JSON.parse(body);
    return (
      payload &&
      payload.code === 0 &&
      payload.message === 'success' &&
      payload.data === 'Hello World!'
    );
  } catch {
    return body.includes('Hello World!');
  }
}

function probePort(port) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: '127.0.0.1',
        port,
        path: '/',
        timeout: HEALTH_CHECK_TIMEOUT_MS,
      },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          resolve({
            status: isHealthyRootResponse(response.statusCode ?? 0, body)
              ? 'healthy'
              : 'occupied',
            port,
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('timeout'));
    });

    request.on('error', (error) => {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? error.code
          : undefined;
      if (code === 'ECONNREFUSED') {
        resolve({ status: 'free', port });
        return;
      }

      resolve({ status: 'occupied', port });
    });
  });
}

async function assessManagedPortState({
  basePort,
  maxPort,
  probe = probePort,
}) {
  let blockedPort = null;
  for (let port = basePort; port <= maxPort; port += 1) {
    const result = await probe(port);
    if (result.status === 'healthy') {
      return { status: 'healthy-existing', port };
    }

    if (result.status === 'occupied' && blockedPort === null) {
      blockedPort = port;
    }
  }

  if (blockedPort !== null) {
    return { status: 'occupied-unhealthy', port: blockedPort };
  }

  return { status: 'free', port: null };
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

async function startChild() {
  if (startInFlight || (restartInFlight && currentChild)) {
    return;
  }
  startInFlight = true;

  try {
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

    if (currentChild || shuttingDown) {
      return;
    }

    const { basePort, maxPort } = getPortRange();
    const portState = await assessManagedPortState({ basePort, maxPort });
    if (currentChild || shuttingDown) {
      return;
    }

    const portSignature = `${portState.status}:${portState.port ?? 'none'}`;
    if (portState.status === 'healthy-existing') {
      if (lastPortStateSignature !== portSignature) {
        log(
          `Detected healthy existing app on port ${portState.port}; reusing existing instance.`,
        );
      }
      lastPortStateSignature = portSignature;
      restartInFlight = false;
      return;
    }

    if (portState.status === 'occupied-unhealthy') {
      if (lastPortStateSignature !== portSignature) {
        logError(
          `PORT_BLOCKED unmanaged listener on port ${portState.port} is not a healthy weather app instance.`,
        );
      }
      lastPortStateSignature = portSignature;
      restartInFlight = false;
      return;
    }

    lastPortStateSignature = null;
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
          void startChild();
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
  } finally {
    startInFlight = false;
  }
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
    void startChild();
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
    void startChild();
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
    void startChild();
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
      void startChild();
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
  void startChild();
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

module.exports = {
  assessManagedPortState,
  isHealthyRootResponse,
  probePort,
};

if (require.main === module) {
  main();
}
