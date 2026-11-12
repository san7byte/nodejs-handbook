// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
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

async function runWithTimeout(fn, timeoutMs = 3000) {
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

async function assertAsyncError(fn, expectedType, expectedMessage) {
  let thrown = null;
  try {
    await fn();
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

  const testTempRoot = path.join(currentDir, `.test-sandbox-${crypto.randomUUID().slice(0, 8)}`);
  await fsp.mkdir(testTempRoot, { recursive: true });

  try {
    // ==========================================================================
    // SECTION 01: readJsonConfig & writeJsonConfig
    // ==========================================================================
    if (targetSuites.includes('01')) {
      console.log('==================================================');
      console.log('SOAL 01: Safe JSON Config Store & Reader');
      console.log('==================================================');

      const loaded = await loadExerciseModule('01');
      if (loaded.error) {
        console.log(`❌ ERROR: ${loaded.error}`);
        grandTotalFailed++;
      } else {
        const { readJsonConfig, writeJsonConfig } = loaded.mod;
        const suiteDir = path.join(testTempRoot, 'suite-01');
        await fsp.mkdir(suiteDir, { recursive: true });

        const tests = [
          {
            name: 'Menulis file konfigurasi JSON dengan nested path dan format rapi',
            fn: async () => {
              const target = path.join(suiteDir, 'nested', 'config.json');
              await writeJsonConfig(target, { env: 'production', port: 8080 });
              const content = await fsp.readFile(target, 'utf8');
              if (!content.endsWith('\n')) throw new Error('File harus diakhiri baris baru (trailing newline)');
              const parsed = JSON.parse(content);
              if (parsed.env !== 'production' || parsed.port !== 8080) {
                throw new Error('Konten JSON tidak cocok dengan data input');
              }
            },
          },
          {
            name: 'Membaca file konfigurasi JSON yang valid',
            fn: async () => {
              const target = path.join(suiteDir, 'read-sample.json');
              await fsp.writeFile(target, JSON.stringify({ database: 'postgres', pool: 10 }), 'utf8');
              const res = await readJsonConfig(target);
              if (res.database !== 'postgres' || res.pool !== 10) {
                throw new Error('Hasil bacaan tidak sesuai dengan data file');
              }
            },
          },
          {
            name: 'Mengembalikan fallback defaultConfig ketika file tidak ada (ENOENT)',
            fn: async () => {
              const missingPath = path.join(suiteDir, 'missing-file.json');
              const fallback = { status: 'default-active' };
              const res = await readJsonConfig(missingPath, fallback);
              if (res !== fallback) {
                throw new Error('Fungsi harus mengembalikan objek fallback saat file tidak ditemukan');
              }
            },
          },
          {
            name: 'Melempar SyntaxError ketika konten file JSON rusak/corrupted',
            fn: async () => {
              const corruptedPath = path.join(suiteDir, 'corrupted.json');
              await fsp.writeFile(corruptedPath, '{"broken": json', 'utf8');
              await assertAsyncError(
                () => readJsonConfig(corruptedPath),
                SyntaxError,
                `Invalid JSON in file: ${corruptedPath}`,
              );
            },
          },
          {
            name: 'Validasi input filePath berupa non-empty string pada readJsonConfig',
            fn: async () => {
              await assertAsyncError(() => readJsonConfig(''), TypeError, 'Invalid argument: filePath must be a non-empty string');
              await assertAsyncError(() => readJsonConfig('   '), TypeError, 'Invalid argument: filePath must be a non-empty string');
              await assertAsyncError(() => readJsonConfig(null), TypeError, 'Invalid argument: filePath must be a non-empty string');
            },
          },
          {
            name: 'Validasi input filePath berupa non-empty string pada writeJsonConfig',
            fn: async () => {
              await assertAsyncError(() => writeJsonConfig('', {}), TypeError, 'Invalid argument: filePath must be a non-empty string');
              await assertAsyncError(() => writeJsonConfig(123, {}), TypeError, 'Invalid argument: filePath must be a non-empty string');
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
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 01: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }

    // ==========================================================================
    // SECTION 02: scanDirectory
    // ==========================================================================
    if (targetSuites.includes('02')) {
      console.log('==================================================');
      console.log('SOAL 02: Recursive Directory Scanner & Metadata Collector');
      console.log('==================================================');

      const loaded = await loadExerciseModule('02');
      if (loaded.error) {
        console.log(`❌ ERROR: ${loaded.error}`);
        grandTotalFailed++;
      } else {
        const { scanDirectory } = loaded.mod;
        const suiteDir = path.join(testTempRoot, 'suite-02');
        await fsp.mkdir(path.join(suiteDir, 'src', 'components'), { recursive: true });
        await fsp.mkdir(path.join(suiteDir, 'docs'), { recursive: true });

        await fsp.writeFile(path.join(suiteDir, 'package.json'), '{"name":"test"}');
        await fsp.writeFile(path.join(suiteDir, 'README.md'), '# Documentation');
        await fsp.writeFile(path.join(suiteDir, 'src', 'index.js'), 'console.log("hi");');
        await fsp.writeFile(path.join(suiteDir, 'src', 'components', 'Button.jsx'), 'export default () => {};');
        await fsp.writeFile(path.join(suiteDir, 'docs', 'guide.md'), 'Guide');

        const tests = [
          {
            name: 'Menjelajahi seluruh direktori dan subdirektori secara rekursif',
            fn: async () => {
              const res = await scanDirectory(suiteDir);
              if (!Array.isArray(res)) throw new Error('Hasil scan harus berupa Array');
              if (res.length !== 5) throw new Error(`Harus menemukan 5 file, namun mendapatkan ${res.length}`);
              const relPaths = res.map((r) => r.relativePath.replaceAll('\\', '/'));
              if (relPaths[0] !== 'docs/guide.md' || relPaths[4] !== 'src/index.js') {
                throw new Error(`Urutan sort relativePath tidak sesuai: ${JSON.stringify(relPaths)}`);
              }
              const item = res.find((r) => r.name === 'index.js');
              if (!item || typeof item.size !== 'number' || item.ext !== '.js') {
                throw new Error('Struktur metadata file tidak lengkap');
              }
            },
          },
          {
            name: 'Menyaring berkas berdasarkan ekstensi (case-insensitive)',
            fn: async () => {
              const res = await scanDirectory(suiteDir, { extensions: ['.md'] });
              if (res.length !== 2) throw new Error(`Harus menemukan 2 file .md, namun dapat ${res.length}`);
              const extMatch = res.every((r) => r.ext === '.md');
              if (!extMatch) throw new Error('Ditemukan file yang tidak cocok filter .md');
            },
          },
          {
            name: 'Membatasi kedalaman traversal dengan opsi maxDepth: 0',
            fn: async () => {
              const res = await scanDirectory(suiteDir, { maxDepth: 0 });
              if (res.length !== 2) throw new Error(`maxDepth 0 harusnya hanya 2 file root, dapat: ${res.length}`);
              const names = res.map((r) => r.name).sort();
              if (names[0] !== 'README.md' || names[1] !== 'package.json') {
                throw new Error(`File root tidak cocok: ${JSON.stringify(names)}`);
              }
            },
          },
          {
            name: 'Melempar Error ketika direktori target tidak ditemukan (ENOENT)',
            fn: async () => {
              const missingDir = path.join(suiteDir, 'ghost-dir');
              await assertAsyncError(
                () => scanDirectory(missingDir),
                Error,
                `Directory not found: ${missingDir}`,
              );
            },
          },
          {
            name: 'Melempar Error ketika path target adalah sebuah file (bukan direktori)',
            fn: async () => {
              const filePath = path.join(suiteDir, 'README.md');
              await assertAsyncError(
                () => scanDirectory(filePath),
                Error,
                `Target is not a directory: ${filePath}`,
              );
            },
          },
          {
            name: 'Validasi argumen dirPath non-empty string',
            fn: async () => {
              await assertAsyncError(() => scanDirectory(''), TypeError, 'Invalid argument: dirPath must be a non-empty string');
              await assertAsyncError(() => scanDirectory(null), TypeError, 'Invalid argument: dirPath must be a non-empty string');
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
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 02: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }

    // ==========================================================================
    // SECTION 03: createAtomicBackup
    // ==========================================================================
    if (targetSuites.includes('03')) {
      console.log('==================================================');
      console.log('SOAL 03: Atomic File Backup & Versioned Rotator');
      console.log('==================================================');

      const loaded = await loadExerciseModule('03');
      if (loaded.error) {
        console.log(`❌ ERROR: ${loaded.error}`);
        grandTotalFailed++;
      } else {
        const { createAtomicBackup } = loaded.mod;
        const suiteDir = path.join(testTempRoot, 'suite-03');
        const backupDir = path.join(suiteDir, 'backups');
        await fsp.mkdir(suiteDir, { recursive: true });

        const sourceFile = path.join(suiteDir, 'server.log');
        await fsp.writeFile(sourceFile, 'LOG DATA PAYLOAD', 'utf8');

        const tests = [
          {
            name: 'Membuat backup berkas secara atomik dan menghasilkan file valid',
            fn: async () => {
              const res = await createAtomicBackup(sourceFile, backupDir);
              if (!res.backupPath || !res.filename) throw new Error('Objek return harus memuat backupPath dan filename');
              if (res.rotatedCount !== 0) throw new Error('Backup pertama tidak boleh menghapus file (rotatedCount harus 0)');
              const exists = fs.existsSync(res.backupPath);
              if (!exists) throw new Error('File backup target tidak ditemukan di disk');
              const content = await fsp.readFile(res.backupPath, 'utf8');
              if (content !== 'LOG DATA PAYLOAD') throw new Error('Isi file backup tidak sama dengan berkas sumber');
            },
          },
          {
            name: 'Melakukan rotasi berkas ketika kuota maxBackups terlampaui',
            fn: async () => {
              // Kita buat backup hingga kuota maxBackups = 2 terpenuhi
              await createAtomicBackup(sourceFile, backupDir, { maxBackups: 2, prefix: 'rot-test' });
              await new Promise((r) => setTimeout(r, 20));
              await createAtomicBackup(sourceFile, backupDir, { maxBackups: 2, prefix: 'rot-test' });
              await new Promise((r) => setTimeout(r, 20));

              // Backup ke-3 harus memicu pemangkasan 1 file tertua
              const res = await createAtomicBackup(sourceFile, backupDir, { maxBackups: 2, prefix: 'rot-test' });
              if (res.rotatedCount < 1) throw new Error(`Harusnya merotasi minimal 1 file, tetapi dapat: ${res.rotatedCount}`);

              const remaining = (await fsp.readdir(backupDir)).filter((f) => f.startsWith('rot-test-'));
              if (remaining.length !== 2) throw new Error(`Jumlah backup tersisa harus tepat 2, namun ada ${remaining.length}`);
            },
          },
          {
            name: 'Melempar Error ketika sourceFile tidak ditemukan',
            fn: async () => {
              const missingFile = path.join(suiteDir, 'ghost.log');
              await assertAsyncError(
                () => createAtomicBackup(missingFile, backupDir),
                Error,
                `Source file does not exist: ${missingFile}`,
              );
            },
          },
          {
            name: 'Melempar Error ketika sourceFile berupa direktori',
            fn: async () => {
              await assertAsyncError(
                () => createAtomicBackup(suiteDir, backupDir),
                Error,
                'Source file cannot be a directory',
              );
            },
          },
          {
            name: 'Validasi argumen sourceFile dan backupDir non-empty string',
            fn: async () => {
              await assertAsyncError(() => createAtomicBackup('', backupDir), TypeError, 'Invalid argument: sourceFile and backupDir must be non-empty strings');
              await assertAsyncError(() => createAtomicBackup(sourceFile, null), TypeError, 'Invalid argument: sourceFile and backupDir must be non-empty strings');
            },
          },
        ];

        let sPassed = 0;
        let sFailed = 0;
        let sNotImpl = 0;

        for (let i = 0; i < tests.length; i++) {
          const t = tests[i];
          try {
            await runWithTimeout(t.fn, 3000);
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
          }
        }

        grandTotalPassed += sPassed;
        grandTotalFailed += sFailed;
        grandTotalNotImplemented += sNotImpl;
        console.log(`\nHasil Soal 03: ${sPassed} lulus, ${sFailed} gagal, ${sNotImpl} belum diimplementasikan.\n`);
      }
    }
  } finally {
    // Bersihkan sandbox folder setelah pengujian selesai
    await fsp.rm(testTempRoot, { recursive: true, force: true }).catch(() => {});
  }

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
