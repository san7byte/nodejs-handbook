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
  let grandTotalNotImplemented = 0;

  // ==========================================================================
  // SECTION 01: resolveAppConfig
  // ==========================================================================
  if (targetSuites.includes('01')) {
    console.log('==================================================');
    console.log('SOAL 01: resolveAppConfig');
    console.log('==================================================');

    const loaded = await loadExerciseModule('01');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      grandTotalFailed++;
    } else {
      const fn = loaded.mod.resolveAppConfig;
      if (typeof fn !== 'function') {
        console.log(`❌ ERROR: Export 'resolveAppConfig' tidak ditemukan di ${loaded.filename}`);
        grandTotalFailed++;
      } else {
        const originalArgv = [...process.argv];
        const originalEnv = { ...process.env };

        const tests = [
          {
            name: 'Default Fallback (port 3000, dev)',
            fn: () => {
              process.argv = ['node', loaded.filename];
              delete process.env.PORT;
              delete process.env.NODE_ENV;
              const result = fn();
              if (result?.port !== 3000) throw new Error(`Expected port 3000, got ${result?.port}`);
              if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
              if (result?.isProduction !== false) throw new Error(`Expected isProduction false, got ${result?.isProduction}`);
            },
          },
          {
            name: 'Custom defaultPort Parameter (5000)',
            fn: () => {
              process.argv = ['node', loaded.filename];
              delete process.env.PORT;
              delete process.env.NODE_ENV;
              const result = fn(5000);
              if (result?.port !== 5000) throw new Error(`Expected port 5000, got ${result?.port}`);
              if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
              if (result?.isProduction !== false) throw new Error(`Expected isProduction false, got ${result?.isProduction}`);
            },
          },
          {
            name: 'CLI Flag & Production Env (--port 6000, NODE_ENV=production)',
            fn: () => {
              process.argv = ['node', 'app.mjs', '--port', '6000'];
              process.env.NODE_ENV = 'production';
              delete process.env.PORT;
              const result = fn(3000);
              if (result?.port !== 6000) throw new Error(`Expected port 6000, got ${result?.port}`);
              if (result?.env !== 'production') throw new Error(`Expected env production, got ${result?.env}`);
              if (result?.isProduction !== true) throw new Error(`Expected isProduction true, got ${result?.isProduction}`);
            },
          },
          {
            name: 'Env PORT Override Default (PORT=8080)',
            fn: () => {
              process.argv = ['node', loaded.filename];
              process.env.PORT = '8080';
              delete process.env.NODE_ENV;
              const result = fn(5000);
              if (result?.port !== 8080) throw new Error(`Expected port 8080, got ${result?.port}`);
              if (result?.env !== 'development') throw new Error(`Expected env development, got ${result?.env}`);
            },
          },
          {
            name: 'CLI Flag Priority over Env Variable (--port 4200 vs PORT=8080)',
            fn: () => {
              process.argv = ['node', 'app.mjs', '--port', '4200'];
              process.env.PORT = '8080';
              const result = fn(3000);
              if (result?.port !== 4200) throw new Error(`Expected port 4200, got ${result?.port}`);
            },
          },
          {
            name: 'Validasi input port bukan angka',
            fn: () => {
              process.argv = ['node', loaded.filename];
              delete process.env.PORT;
              assertError(() => fn('not-a-number'), Error, 'Invalid port number');
            },
          },
          {
            name: 'Validasi port di atas batas 65535 (99999)',
            fn: () => {
              process.argv = ['node', loaded.filename];
              delete process.env.PORT;
              assertError(() => fn(99999), Error, 'Invalid port number');
            },
          },
          {
            name: 'Validasi port di bawah batas 1 (0)',
            fn: () => {
              process.argv = ['node', loaded.filename];
              delete process.env.PORT;
              assertError(() => fn(0), Error, 'Invalid port number');
            },
          },
        ];

        let sPassed = 0;
        let sFailed = 0;
        let sNotImpl = 0;

        for (let i = 0; i < tests.length; i++) {
          const t = tests[i];
          try {
            await runWithTimeout(t.fn, 2000);
            console.log(`  ✅ Skenario ${i + 1}: ${t.name}`);
            sPassed++;
          } catch (err) {
            if (err.message === 'Not implemented') {
              console.log(`  ⏳ Skenario ${i + 1}: ${t.name} (Belum diimplementasikan)`);
              sNotImpl++;
            } else {
              console.log(`  ❌ Skenario ${i + 1}: ${t.name} -> ${err.message}`);
              sFailed++;
            }
          } finally {
            process.argv = [...originalArgv];
            process.env = { ...originalEnv };
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 01: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }
  }

  // ==========================================================================
  // SECTION 02: validateRuntimeEnvironment
  // ==========================================================================
  if (targetSuites.includes('02')) {
    console.log('==================================================');
    console.log('SOAL 02: validateRuntimeEnvironment');
    console.log('==================================================');

    const loaded = await loadExerciseModule('02');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      grandTotalFailed++;
    } else {
      const fn = loaded.mod.validateRuntimeEnvironment;
      if (typeof fn !== 'function') {
        console.log(`❌ ERROR: Export 'validateRuntimeEnvironment' tidak ditemukan di ${loaded.filename}`);
        grandTotalFailed++;
      } else {
        const originalEnv = { ...process.env };
        const originalExitCode = process.exitCode;

        const tests = [
          {
            name: 'Semua Key Valid',
            fn: () => {
              process.env.APP_NAME = 'PaymentGateway';
              process.env.APP_PORT = '3000';
              const result = fn(['APP_NAME', 'APP_PORT']);
              if (result !== true) throw new Error(`Expected result true, got ${result}`);
              if (process.exitCode !== 0) throw new Error(`Expected exitCode 0, got ${process.exitCode}`);
            },
          },
          {
            name: 'Key Hilang / Undefined',
            fn: () => {
              process.env.APP_NAME = 'PaymentGateway';
              delete process.env.SECRET_KEY;
              const result = fn(['APP_NAME', 'SECRET_KEY']);
              if (result !== false) throw new Error(`Expected result false, got ${result}`);
              if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
            },
          },
          {
            name: 'Key Bernilai String Kosong / Spasi',
            fn: () => {
              process.env.TOKEN = '   ';
              const result = fn(['TOKEN']);
              if (result !== false) throw new Error(`Expected result false, got ${result}`);
              if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
            },
          },
          {
            name: 'Multi-Key Hilang Sekaligus',
            fn: () => {
              delete process.env.KEY_A;
              delete process.env.KEY_B;
              const result = fn(['KEY_A', 'KEY_B']);
              if (result !== false) throw new Error(`Expected result false, got ${result}`);
              if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
            },
          },
          {
            name: 'Parameter Bukan Array melempar TypeError',
            fn: () => {
              assertError(
                () => fn('not-an-array'),
                TypeError,
                'requiredEnvKeys must be an array of strings',
              );
            },
          },
        ];

        let sPassed = 0;
        let sFailed = 0;
        let sNotImpl = 0;

        for (let i = 0; i < tests.length; i++) {
          const t = tests[i];
          try {
            process.exitCode = undefined;
            await runWithTimeout(t.fn, 2000);
            console.log(`  ✅ Skenario ${i + 1}: ${t.name}`);
            sPassed++;
          } catch (err) {
            if (err.message === 'Not implemented') {
              console.log(`  ⏳ Skenario ${i + 1}: ${t.name} (Belum diimplementasikan)`);
              sNotImpl++;
            } else {
              console.log(`  ❌ Skenario ${i + 1}: ${t.name} -> ${err.message}`);
              sFailed++;
            }
          } finally {
            process.env = { ...originalEnv };
            process.exitCode = originalExitCode;
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 02: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }
  }

  // ==========================================================================
  // SECTION 03: GracefulServer
  // ==========================================================================
  if (targetSuites.includes('03')) {
    console.log('==================================================');
    console.log('SOAL 03: GracefulServer');
    console.log('==================================================');

    const loaded = await loadExerciseModule('03');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      grandTotalFailed++;
    } else {
      const Cls = loaded.mod.GracefulServer;
      if (typeof Cls !== 'function') {
        console.log(`❌ ERROR: Export 'GracefulServer' tidak ditemukan di ${loaded.filename}`);
        grandTotalFailed++;
      } else {
        const originalExit = process.exit;

        function cleanupListeners() {
          process.removeAllListeners('SIGTERM');
          process.removeAllListeners('SIGINT');
        }

        const tests = [
          {
            name: 'Inisialisasi Constructor & State Awal',
            fn: () => {
              const server = new Cls({ serviceName: 'OrderSvc', drainDelayMs: 100 });
              if (server.serviceName !== 'OrderSvc') throw new Error(`Expected OrderSvc, got ${server.serviceName}`);
              if (server.drainDelayMs !== 100) throw new Error(`Expected 100, got ${server.drainDelayMs}`);
              if (server.isShuttingDown !== false) throw new Error(`Expected isShuttingDown false, got ${server.isShuttingDown}`);
            },
          },
          {
            name: 'Method start() Mendaftarkan Listener SIGTERM/SIGINT',
            fn: () => {
              const server = new Cls({ serviceName: 'PaymentSvc' });
              const returned = server.start();
              if (returned !== server) throw new Error('start() harus mengembalikan instance this');
              if (process.listenerCount('SIGTERM') < 1) throw new Error('Harus mendaftarkan listener SIGTERM');
              if (process.listenerCount('SIGINT') < 1) throw new Error('Harus mendaftarkan listener SIGINT');
            },
          },
          {
            name: 'simulateSignal dan Safe Exit dengan Delay',
            fn: async () => {
              let exitCodeCalled = null;
              process.exit = (code) => {
                exitCodeCalled = code;
              };

              const server = new Cls({ serviceName: 'GatewaySvc', drainDelayMs: 20 });
              server.start();
              server.simulateSignal('SIGTERM');

              if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus true saat sinyal diterima');

              await new Promise((resolve) => setTimeout(resolve, 60));
              if (exitCodeCalled !== 0) throw new Error(`Expected process.exit(0) dipanggil, got: ${exitCodeCalled}`);
            },
          },
          {
            name: 'Fallback Default drainDelayMs (200)',
            fn: () => {
              const server = new Cls({ serviceName: 'AuthSvc' });
              if (server.drainDelayMs !== 200) throw new Error(`Expected drainDelayMs 200, got ${server.drainDelayMs}`);
            },
          },
          {
            name: 'Idempotensi Penanganan Sinyal Ganda',
            fn: () => {
              const server = new Cls({ serviceName: 'ReportSvc', drainDelayMs: 50 });
              server.stop('SIGTERM');
              if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus bernilai true setelah stop()');
              server.stop('SIGINT');
              if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus tetap true');
            },
          },
          {
            name: 'Validasi serviceName pada Constructor',
            fn: () => {
              assertError(
                () => new Cls({}),
                Error,
                'serviceName is required and must be a string',
              );
            },
          },
        ];

        let sPassed = 0;
        let sFailed = 0;
        let sNotImpl = 0;

        for (let i = 0; i < tests.length; i++) {
          const t = tests[i];
          try {
            cleanupListeners();
            await runWithTimeout(t.fn, 2000);
            console.log(`  ✅ Skenario ${i + 1}: ${t.name}`);
            sPassed++;
          } catch (err) {
            if (err.message === 'Not implemented') {
              console.log(`  ⏳ Skenario ${i + 1}: ${t.name} (Belum diimplementasikan)`);
              sNotImpl++;
            } else {
              console.log(`  ❌ Skenario ${i + 1}: ${t.name} -> ${err.message}`);
              sFailed++;
            }
          } finally {
            cleanupListeners();
            process.exit = originalExit;
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 03: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }
  }

  // ==========================================================================
  // RINGKASAN TOTAL
  // ==========================================================================
  console.log('--------------------------------------------------');
  console.log(
    `Total Keseluruhan: ${grandTotalPassed} lulus, ${grandTotalFailed} gagal, ${grandTotalNotImplemented} belum diimplementasikan`,
  );
  console.log('--------------------------------------------------');

  if (grandTotalFailed > 0) {
    process.exitCode = 1;
  }
}

executeTestSuite();
