// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

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
  // SECTION 01: normalizeAssetPath (8 Skenario)
  // ==========================================================================
  if (targetSuites.includes('01')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 01: normalizeAssetPath ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('01');
    const scenarios = [
      {
        name: 'Normal 1: Relative Path',
        run: (normalizeAssetPath) => {
          const res = normalizeAssetPath('uploads', 'images/avatar.png');
          const expectedPath = path.join('uploads', 'images', 'avatar.png');
          const expectedDir = path.join('uploads', 'images');

          if (res.fullPath !== expectedPath) throw new Error(`fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`);
          if (res.isAbsolute !== false) throw new Error(`isAbsolute mismatch: expected false, got ${res.isAbsolute}`);
          if (res.dirname !== expectedDir) throw new Error(`dirname mismatch: expected ${expectedDir}, got ${res.dirname}`);
          if (res.basename !== 'avatar.png') throw new Error(`basename mismatch: expected avatar.png, got ${res.basename}`);
          if (res.extname !== '.png') throw new Error(`extname mismatch: expected .png, got ${res.extname}`);
          if (res.filenameWithoutExt !== 'avatar') throw new Error(`filenameWithoutExt mismatch: expected avatar, got ${res.filenameWithoutExt}`);
        },
      },
      {
        name: 'Normal 2: Absolute Path',
        run: (normalizeAssetPath) => {
          const res = normalizeAssetPath('/var/www', 'public/styles.min.css');
          const expectedPath = path.normalize('/var/www/public/styles.min.css');
          const expectedDir = path.normalize('/var/www/public');

          if (res.fullPath !== expectedPath) throw new Error(`fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`);
          if (res.isAbsolute !== true) throw new Error(`isAbsolute mismatch: expected true, got ${res.isAbsolute}`);
          if (res.dirname !== expectedDir) throw new Error(`dirname mismatch: expected ${expectedDir}, got ${res.dirname}`);
          if (res.basename !== 'styles.min.css') throw new Error(`basename mismatch: expected styles.min.css, got ${res.basename}`);
          if (res.extname !== '.css') throw new Error(`extname mismatch: expected .css, got ${res.extname}`);
          if (res.filenameWithoutExt !== 'styles.min') throw new Error(`filenameWithoutExt mismatch: expected styles.min, got ${res.filenameWithoutExt}`);
        },
      },
      {
        name: 'Edge 1: Redundant Slashes & Navigation Segments',
        run: (normalizeAssetPath) => {
          const res = normalizeAssetPath('/app/data', '../config//db.json');
          const expectedPath = path.normalize('/app/config/db.json');
          const expectedDir = path.normalize('/app/config');

          if (res.fullPath !== expectedPath) throw new Error(`fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`);
          if (res.isAbsolute !== true) throw new Error(`isAbsolute mismatch: expected true, got ${res.isAbsolute}`);
          if (res.dirname !== expectedDir) throw new Error(`dirname mismatch: expected ${expectedDir}, got ${res.dirname}`);
          if (res.basename !== 'db.json') throw new Error(`basename mismatch: expected db.json, got ${res.basename}`);
          if (res.extname !== '.json') throw new Error(`extname mismatch: expected .json, got ${res.extname}`);
          if (res.filenameWithoutExt !== 'db') throw new Error(`filenameWithoutExt mismatch: expected db, got ${res.filenameWithoutExt}`);
        },
      },
      {
        name: 'Edge 2: Dotfile tanpa ekstensi sekunder (.env)',
        run: (normalizeAssetPath) => {
          const res = normalizeAssetPath('project', '.env');
          const expectedPath = path.join('project', '.env');

          if (res.fullPath !== expectedPath) throw new Error(`fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`);
          if (res.basename !== '.env') throw new Error(`basename mismatch: expected .env, got ${res.basename}`);
          if (res.extname !== '') throw new Error(`extname mismatch: expected empty string, got '${res.extname}'`);
          if (res.filenameWithoutExt !== '.env') throw new Error(`filenameWithoutExt mismatch: expected .env, got ${res.filenameWithoutExt}`);
        },
      },
      {
        name: 'Edge 3: Multi-dot Archive File (.tar.gz)',
        run: (normalizeAssetPath) => {
          const res = normalizeAssetPath('backup', 'data.tar.gz');
          if (res.basename !== 'data.tar.gz') throw new Error(`basename mismatch: expected data.tar.gz, got ${res.basename}`);
          if (res.extname !== '.gz') throw new Error(`extname mismatch: expected .gz, got ${res.extname}`);
          if (res.filenameWithoutExt !== 'data.tar') throw new Error(`filenameWithoutExt mismatch: expected data.tar, got ${res.filenameWithoutExt}`);
        },
      },
      {
        name: 'Error 1: String Kosong',
        run: (normalizeAssetPath) => {
          assertError(
            () => normalizeAssetPath('', 'doc.pdf'),
            TypeError,
            'must be non-empty strings',
          );
        },
      },
      {
        name: 'Error 2: String Hanya Spasi',
        run: (normalizeAssetPath) => {
          assertError(
            () => normalizeAssetPath('data', '   '),
            TypeError,
            'must be non-empty strings',
          );
        },
      },
      {
        name: 'Error 3: Tipe Data Bukan String',
        run: (normalizeAssetPath) => {
          assertError(
            () => normalizeAssetPath(null, 123),
            TypeError,
            'must be non-empty strings',
          );
        },
      },
    ];

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const fn = loaded.mod.normalizeAssetPath;
      if (typeof fn !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'normalizeAssetPath' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        await runWithTimeout(() => sc.run(fn));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
      }
    }

    console.log(`--------------------------------------------------`);
    console.log(`Soal 01: ${passed} passed, ${failed} failed`);
    grandTotalPassed += passed;
    grandTotalFailed += failed;
  }

  // ==========================================================================
  // SECTION 02: buildApiEndpoint (9 Skenario)
  // ==========================================================================
  if (targetSuites.includes('02')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 02: buildApiEndpoint ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('02');
    const scenarios = [
      {
        name: 'Normal 1: Standard URL & Pagination',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com', 'v1/users', { page: 1, limit: 10 });
          const expected = 'https://api.example.com/v1/users?page=1&limit=10';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Normal 2: Slash Resolution & Special Characters (+ and space)',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com/api/', '/search', { q: 'c++ developer' });
          const expected = 'https://api.example.com/api/search?q=c%2B%2B+developer';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Edge 1: Array Query Parameters',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com', 'filter', { status: ['active', 'pending'] });
          const expected = 'https://api.example.com/filter?status=active&status=pending';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Edge 2: Filtering Null & Undefined Parameters',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com', 'users', { active: true, role: null, q: undefined });
          const expected = 'https://api.example.com/users?active=true';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Edge 3: Fragment Hash Support',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com', 'docs', {}, { hash: 'section-2' });
          const expected = 'https://api.example.com/docs#section-2';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Edge 4: Preserving Pre-existing Query Parameters',
        run: (buildApiEndpoint) => {
          const result = buildApiEndpoint('https://api.example.com?key=token', 'status', { format: 'json' });
          const expected = 'https://api.example.com/status?key=token&format=json';
          if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
        },
      },
      {
        name: 'Error 1: Invalid Base URL Format',
        run: (buildApiEndpoint) => {
          assertError(
            () => buildApiEndpoint('not-a-valid-url', 'users'),
            TypeError,
            'Must be a parseable URL',
          );
        },
      },
      {
        name: 'Error 2: Disallowed Scheme (javascript:)',
        run: (buildApiEndpoint) => {
          assertError(
            () => buildApiEndpoint('javascript:alert(1)'),
            Error,
            'Only HTTP/HTTPS URLs are allowed',
          );
        },
      },
      {
        name: 'Error 3: Disallowed Scheme (file:)',
        run: (buildApiEndpoint) => {
          assertError(
            () => buildApiEndpoint('file:///etc/passwd'),
            Error,
            'Only HTTP/HTTPS URLs are allowed',
          );
        },
      },
    ];

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const fn = loaded.mod.buildApiEndpoint;
      if (typeof fn !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'buildApiEndpoint' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        await runWithTimeout(() => sc.run(fn));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
      }
    }

    console.log(`--------------------------------------------------`);
    console.log(`Soal 02: ${passed} passed, ${failed} failed`);
    grandTotalPassed += passed;
    grandTotalFailed += failed;
  }

  // ==========================================================================
  // SECTION 03: SecureFileStorage (11 Skenario)
  // ==========================================================================
  if (targetSuites.includes('03')) {
    let passed = 0;
    let failed = 0;
    console.log('\n==================================================');
    console.log('=== SOAL 03: SecureFileStorage ===');
    console.log('==================================================');

    const loaded = await loadExerciseModule('03');
    const mockStorageRoot = path.join(os.tmpdir(), 'secure-app-storage-test');

    const scenarios = [
      {
        name: 'Normal 1: Standard File Resolution',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          const result = storage.resolveSafePath('documents/annual-report.pdf');
          const expectedAbs = path.join(mockStorageRoot, 'documents', 'annual-report.pdf');
          const expectedRel = path.join('documents', 'annual-report.pdf');

          if (result.absolutePath !== expectedAbs) throw new Error(`absolutePath mismatch: expected ${expectedAbs}, got ${result.absolutePath}`);
          if (result.relativePath !== expectedRel) throw new Error(`relativePath mismatch: expected ${expectedRel}, got ${result.relativePath}`);
          if (!(result.fileURL instanceof URL)) throw new Error('fileURL must be an instance of URL');
          if (result.fileURL.protocol !== 'file:') throw new Error(`fileURL protocol must be file:, got ${result.fileURL.protocol}`);
        },
      },
      {
        name: 'Normal 2: Special Characters (#, %, space) in Filename',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          const result = storage.resolveSafePath('assets/report #1 [100%].pdf');

          if (!result.fileURL.href.includes('%231')) throw new Error('URL must percent-encode # character to %23');
          if (!result.fileURL.href.includes('%25')) throw new Error('URL must percent-encode % character to %25');
        },
      },
      {
        name: 'Normal 3: toFilePath Roundtrip Conversion',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          const result = storage.resolveSafePath('assets/report #1 [100%].pdf');
          const converted = storage.toFilePath(result.fileURL);

          if (converted !== result.absolutePath) {
            throw new Error(`toFilePath mismatch: expected ${result.absolutePath}, got ${converted}`);
          }
        },
      },
      {
        name: 'Edge 1: Relative Hops Normalization',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          const result = storage.resolveSafePath('docs/./drafts/../final.csv');
          const expectedRel = path.join('docs', 'final.csv');

          if (result.relativePath !== expectedRel) {
            throw new Error(`relativePath mismatch: expected ${expectedRel}, got ${result.relativePath}`);
          }
        },
      },
      {
        name: 'Edge 2: Storage Root Reference (.)',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          const result = storage.resolveSafePath('.');

          if (result.absolutePath !== storage.rootDirectory) {
            throw new Error(`absolutePath must match rootDirectory: expected ${storage.rootDirectory}, got ${result.absolutePath}`);
          }
          if (result.relativePath !== '') {
            throw new Error(`relativePath must be empty string for root, got '${result.relativePath}'`);
          }
        },
      },
      {
        name: 'Error 1: Path Traversal Attack (../../etc/passwd)',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          assertError(
            () => storage.resolveSafePath('../../etc/passwd'),
            Error,
            'Path traversal detected',
          );
        },
      },
      {
        name: 'Error 2: Sibling Directory Escape Bypass',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          assertError(
            () => storage.resolveSafePath('../secure-app-storage-leak/secret.key'),
            Error,
            'Path traversal detected',
          );
        },
      },
      {
        name: 'Error 3: Null Byte Injection Detection',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          assertError(
            () => storage.resolveSafePath('safe.pdf\0.exe'),
            Error,
            'Null byte detected',
          );
        },
      },
      {
        name: 'Error 4: Constructor Argument Validation',
        run: (SecureFileStorage) => {
          assertError(
            () => new SecureFileStorage(''),
            TypeError,
            'Must be a non-empty string',
          );
        },
      },
      {
        name: 'Error 5: toFilePath Non-file Scheme Rejection',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          assertError(
            () => storage.toFilePath('https://api.example.com/asset.png'),
            Error,
            'Must be a file: URL',
          );
        },
      },
      {
        name: 'Error 6: toFilePath File Outside Storage Root',
        run: (SecureFileStorage) => {
          const storage = new SecureFileStorage(mockStorageRoot);
          assertError(
            () => storage.toFilePath('file:///etc/passwd'),
            Error,
            'Path outside storage root',
          );
        },
      },
    ];

    for (const sc of scenarios) {
      if (loaded.error) {
        console.log(`  [FAIL] ${sc.name}: ${loaded.error}`);
        failed++;
        continue;
      }
      const Cls = loaded.mod.SecureFileStorage;
      if (typeof Cls !== 'function') {
        console.log(`  [FAIL] ${sc.name}: Export 'SecureFileStorage' tidak ditemukan di ${loaded.filename}`);
        failed++;
        continue;
      }

      try {
        await runWithTimeout(() => sc.run(Cls));
        console.log(`  [PASS] ${sc.name}`);
        passed++;
      } catch (err) {
        console.log(`  [FAIL] ${sc.name}: ${err.message}`);
        failed++;
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
