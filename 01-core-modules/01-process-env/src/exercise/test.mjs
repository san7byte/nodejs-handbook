// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function printUsage() {
  console.log('Penggunaan:');
  console.log('  node test.mjs       -> Menjalankan semua test (01, 02, 03)');
  console.log('  node test.mjs 01    -> Hanya menjalankan test Soal 01');
  console.log('  node test.mjs 02    -> Hanya menjalankan test Soal 02');
  console.log('  node test.mjs 03    -> Hanya menjalankan test Soal 03');
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return ['01', '02', '03'];
  }
  if (args.length === 1) {
    const raw = args[0].trim();
    const map = {
      '1': '01',
      '01': '01',
      '2': '02',
      '02': '02',
      '3': '03',
      '03': '03',
    };
    if (map[raw]) {
      return [map[raw]];
    }
  }
  return null;
}

function findExerciseFile(prefix) {
  const files = fs.readdirSync(currentDir);
  return files.find(
    (file) =>
      file.startsWith(`${prefix}-`) &&
      (file.endsWith('.mjs') || file.endsWith('.js')),
  );
}

async function loadExerciseModule(prefix) {
  const filename = findExerciseFile(prefix);
  if (!filename) {
    return { error: `File soal dengan prefix '${prefix}-' tidak ditemukan di ${currentDir}` };
  }
  const fullPath = path.join(currentDir, filename);
  try {
    const mod = await import(pathToFileURL(fullPath).href);
    return { mod, filename };
  } catch (err) {
    return { error: `Gagal mengimpor file '${filename}': ${err.message}` };
  }
}

async function runWithTimeout(fn, timeoutMs = 2000) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (timerId.unref) timerId.unref();
  });

  try {
    return await Promise.race([Promise.resolve().then(() => fn()), timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }
}

function assertError(fn, expectedType, expectedMessage) {
  let thrown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }

  if (!thrown) {
    throw new Error(`Expected ${expectedType.name} to be thrown, but nothing was thrown`);
  }
  if (thrown.message === 'Not implemented') {
    throw new Error('Not implemented');
  }
  if (!(thrown instanceof expectedType)) {
    throw new Error(`Expected ${expectedType.name}, got ${thrown.name}: ${thrown.message}`);
  }
  if (expectedMessage && !thrown.message.includes(expectedMessage)) {
    throw new Error(`Expected error message to include '${expectedMessage}', got: '${thrown.message}'`);
  }
}

async function executeTestSuite() {
  const targetSuites = parseCliArgs();
  if (!targetSuites) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;

  // ==========================================================================
  // SECTION 01: resolveAppConfig (8 Skenario)
  // ==========================================================================
  if (targetSuites.includes('01')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 01: resolveAppConfig ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('01');
    const scenarios = [
      {
        name: 'Normal 1: Default Fallback (port 3000, dev)',
        run: (resolveAppConfig) => {
          const result = resolveAppConfig();
          if (result?.port !== 3000) throw new Error(`Expected port 3000, got ${result?.port}`);
          if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
          if (result?.isProduction !== false) throw new Error(`Expected isProduction false, got ${result?.isProduction}`);
        },
      },
      {
        name: 'Normal 2: Custom defaultPort Parameter (5000)',
        run: (resolveAppConfig) => {
          const result = resolveAppConfig(5000);
          if (result?.port !== 5000) throw new Error(`Expected port 5000, got ${result?.port}`);
          if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
          if (result?.isProduction !== false) throw new Error(`Expected isProduction false, got ${result?.isProduction}`);
        },
      },
      {
        name: 'Normal 3: CLI Flag & Production Env (--port 6000, NODE_ENV=production)',
        run: (resolveAppConfig) => {
          process.argv = ['node', 'app.mjs', '--port', '6000'];
          process.env.NODE_ENV = 'production';
          const result = resolveAppConfig(3000);
          if (result?.port !== 6000) throw new Error(`Expected port 6000, got ${result?.port}`);
          if (result?.env !== 'production') throw new Error(`Expected env production, got ${result?.env}`);
          if (result?.isProduction !== true) throw new Error(`Expected isProduction true, got ${result?.isProduction}`);
        },
      },
      {
        name: 'Edge 1: Env PORT Override Default (PORT=8080)',
        run: (resolveAppConfig) => {
          process.env.PORT = '8080';
          const result = resolveAppConfig(5000);
          if (result?.port !== 8080) throw new Error(`Expected port 8080, got ${result?.port}`);
          if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
        },
      },
      {
        name: 'Edge 2: CLI Flag Priority over Env Variable (--port 4200 vs PORT=8080)',
        run: (resolveAppConfig) => {
          process.argv = ['node', 'app.mjs', '--port', '4200'];
          process.env.PORT = '8080';
          const result = resolveAppConfig(3000);
          if (result?.port !== 4200) throw new Error(`Expected port 4200, got ${result?.port}`);
        },
      },
      {
        name: 'Error 1: Port Bukan Angka',
        run: (resolveAppConfig) => {
          assertError(() => resolveAppConfig('not-a-number'), Error, 'Invalid port number');
        },
      },
      {
        name: 'Error 2: Port di Atas Batas 65535 (99999)',
        run: (resolveAppConfig) => {
          assertError(() => resolveAppConfig(99999), Error, 'Invalid port number');
        },
      },
      {
        name: 'Error 3: Port di Bawah Batas 1 (0)',
        run: (resolveAppConfig) => {
          assertError(() => resolveAppConfig(0), Error, 'Invalid port number');
        },
      },
    ];

    const originalArgv = [...process.argv];
    const originalEnv = { ...process.env };

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const fn = loaded.mod.resolveAppConfig;
      if (typeof fn !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'resolveAppConfig' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        process.argv = ['node', loaded.filename];
        delete process.env.PORT;
        delete process.env.NODE_ENV;

        await runWithTimeout(() => sc.run(fn));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
      } finally {
        process.argv = [...originalArgv];
        process.env = { ...originalEnv };
      }
    }

    console.log(`--------------------------------------------------`);
    console.log(`Soal 01: ${passed} passed, ${failed} failed`);
    grandTotalPassed += passed;
    grandTotalFailed += failed;
  }

  // ==========================================================================
  // SECTION 02: validateRuntimeEnvironment (5 Skenario)
  // ==========================================================================
  if (targetSuites.includes('02')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 02: validateRuntimeEnvironment ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('02');
    const scenarios = [
      {
        name: 'Normal 1: Semua Key Valid',
        run: (validateRuntimeEnvironment) => {
          process.env.APP_NAME = 'PaymentGateway';
          process.env.APP_PORT = '3000';
          const result = validateRuntimeEnvironment(['APP_NAME', 'APP_PORT']);
          if (result !== true) throw new Error(`Expected result true, got ${result}`);
          if (process.exitCode !== 0) throw new Error(`Expected exitCode 0, got ${process.exitCode}`);
        },
      },
      {
        name: 'Edge 1: Key Hilang / Undefined',
        run: (validateRuntimeEnvironment) => {
          process.env.APP_NAME = 'PaymentGateway';
          delete process.env.SECRET_KEY;
          const result = validateRuntimeEnvironment(['APP_NAME', 'SECRET_KEY']);
          if (result !== false) throw new Error(`Expected result false, got ${result}`);
          if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
        },
      },
      {
        name: 'Edge 2: Key Bernilai String Kosong / Spasi',
        run: (validateRuntimeEnvironment) => {
          process.env.TOKEN = '   ';
          const result = validateRuntimeEnvironment(['TOKEN']);
          if (result !== false) throw new Error(`Expected result false, got ${result}`);
          if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
        },
      },
      {
        name: 'Edge 3: Multi-Key Hilang Sekaligus',
        run: (validateRuntimeEnvironment) => {
          delete process.env.KEY_A;
          delete process.env.KEY_B;
          const result = validateRuntimeEnvironment(['KEY_A', 'KEY_B']);
          if (result !== false) throw new Error(`Expected result false, got ${result}`);
          if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
        },
      },
      {
        name: 'Error 1: Parameter Bukan Array',
        run: (validateRuntimeEnvironment) => {
          assertError(
            () => validateRuntimeEnvironment('not-an-array'),
            TypeError,
            'requiredEnvKeys must be an array of strings',
          );
        },
      },
    ];

    const originalEnv = { ...process.env };
    const originalExitCode = process.exitCode;

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const fn = loaded.mod.validateRuntimeEnvironment;
      if (typeof fn !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'validateRuntimeEnvironment' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        process.exitCode = undefined;
        await runWithTimeout(() => sc.run(fn));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
      } finally {
        process.env = { ...originalEnv };
        process.exitCode = originalExitCode;
      }
    }

    console.log(`--------------------------------------------------`);
    console.log(`Soal 02: ${passed} passed, ${failed} failed`);
    grandTotalPassed += passed;
    grandTotalFailed += failed;
  }

  // ==========================================================================
  // SECTION 03: GracefulServer (6 Skenario)
  // ==========================================================================
  if (targetSuites.includes('03')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 03: GracefulServer ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('03');
    const scenarios = [
      {
        name: 'Normal 1: Inisialisasi Constructor & State Awal',
        run: async (GracefulServer) => {
          const server = new GracefulServer({ serviceName: 'OrderSvc', drainDelayMs: 100 });
          if (server.serviceName !== 'OrderSvc') throw new Error(`Expected OrderSvc, got ${server.serviceName}`);
          if (server.drainDelayMs !== 100) throw new Error(`Expected 100, got ${server.drainDelayMs}`);
          if (server.isShuttingDown !== false) throw new Error(`Expected isShuttingDown false, got ${server.isShuttingDown}`);
        },
      },
      {
        name: 'Normal 2: Method start() Mendaftarkan Listener SIGTERM/SIGINT',
        run: async (GracefulServer) => {
          const server = new GracefulServer({ serviceName: 'PaymentSvc' });
          const returned = server.start();
          if (returned !== server) throw new Error('start() harus mengembalikan instance this');
          if (process.listenerCount('SIGTERM') < 1) throw new Error('Harus mendaftarkan listener SIGTERM');
          if (process.listenerCount('SIGINT') < 1) throw new Error('Harus mendaftarkan listener SIGINT');
        },
      },
      {
        name: 'Normal 3: simulateSignal dan Safe Exit dengan Delay',
        run: async (GracefulServer) => {
          let exitCodeCalled = null;
          process.exit = (code) => {
            exitCodeCalled = code;
          };

          const server = new GracefulServer({ serviceName: 'GatewaySvc', drainDelayMs: 20 });
          server.start();
          server.simulateSignal('SIGTERM');

          if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus true saat sinyal diterima');

          await new Promise((resolve) => setTimeout(resolve, 60));
          if (exitCodeCalled !== 0) throw new Error(`Expected process.exit(0) dipanggil, got: ${exitCodeCalled}`);
        },
      },
      {
        name: 'Edge 1: Fallback Default drainDelayMs (200)',
        run: async (GracefulServer) => {
          const server = new GracefulServer({ serviceName: 'AuthSvc' });
          if (server.drainDelayMs !== 200) throw new Error(`Expected drainDelayMs 200, got ${server.drainDelayMs}`);
        },
      },
      {
        name: 'Edge 2: Idempotensi Penanganan Sinyal Ganda',
        run: async (GracefulServer) => {
          const server = new GracefulServer({ serviceName: 'ReportSvc', drainDelayMs: 50 });
          server.stop('SIGTERM');
          if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus bernilai true setelah stop()');
          server.stop('SIGINT');
          if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus tetap true');
        },
      },
      {
        name: 'Error 1: Validasi serviceName pada Constructor',
        run: async (GracefulServer) => {
          assertError(
            () => new GracefulServer({}),
            Error,
            'serviceName is required and must be a string',
          );
        },
      },
    ];

    const originalExit = process.exit;

    function cleanupListeners() {
      process.removeAllListeners('SIGTERM');
      process.removeAllListeners('SIGINT');
    }

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const Cls = loaded.mod.GracefulServer;
      if (typeof Cls !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'GracefulServer' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        cleanupListeners();
        await runWithTimeout(() => sc.run(Cls));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
      } finally {
        cleanupListeners();
        process.exit = originalExit;
      }
    }

    console.log(`--------------------------------------------------`);
    console.log(`Soal 03: ${passed} passed, ${failed} failed`);
    grandTotalPassed += passed;
    grandTotalFailed += failed;
  }

  // ==========================================================================
  // GRAND TOTAL SUMMARY (Jika menjalankan lebih dari satu soal)
  // ==========================================================================
  if (targetSuites.length > 1) {
    console.log('\n==================================================');
    console.log(`TOTAL: ${grandTotalPassed} passed, ${grandTotalFailed} failed`);
    console.log('==================================================\n');
  }

  if (grandTotalFailed > 0) {
    process.exitCode = 1;
  }
}

executeTestSuite();
