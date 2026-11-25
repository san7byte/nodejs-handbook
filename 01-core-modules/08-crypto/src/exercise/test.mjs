// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import crypto from 'node:crypto';
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
    return { module: mod, filename };
  } catch (err) {
    return { error: `Gagal mengimpor file '${filename}': ${err.message}` };
  }
}

async function runWithTimeout(fn, timeoutMs = 2000) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Test timeout (melampaui batas ${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      Promise.resolve().then(() => fn()),
      timeoutPromise,
    ]);
    return result;
  } finally {
    clearTimeout(timerId);
  }
}

function assertError(err, expectedType, expectedMessage) {
  if (err.message === 'Not implemented') {
    throw new Error('Fungsi belum diimplementasikan (melempar "Not implemented")');
  }
  if (!(err instanceof expectedType) && err.name !== expectedType.name) {
    throw new Error(
      `Tipe error salah: diharapkan '${expectedType.name}', diterima '${err.name || typeof err}'`,
    );
  }
  if (err.message !== expectedMessage) {
    throw new Error(
      `Pesan error salah:\n  diharapkan: "${expectedMessage}"\n  diterima:   "${err.message}"`,
    );
  }
}

// ============================================================================
// DEFINISI TEST SUITE SOAL 01
// ============================================================================
const testsSoal01 = [
  {
    name: 'Normal 1: createHmacSignature(secret-key, hello-world)',
    run: (mod) => {
      const res = mod.createHmacSignature('secret-key', 'hello-world');
      const expected = crypto.createHmac('sha256', 'secret-key').update('hello-world').digest('hex');
      if (res !== expected) {
        throw new Error(`Digest tidak sesuai: diterima '${res}', diharapkan '${expected}'`);
      }
    },
  },
  {
    name: 'Normal 2: createHmacSignature(secret-key, hello-world, sha512)',
    run: (mod) => {
      const res = mod.createHmacSignature('secret-key', 'hello-world', 'sha512');
      const expected = crypto.createHmac('sha512', 'secret-key').update('hello-world').digest('hex');
      if (res !== expected) {
        throw new Error(`Digest sha512 tidak sesuai: diterima '${res}', diharapkan '${expected}'`);
      }
      if (res.length !== 128) {
        throw new Error(`Panjang hex sha512 salah: diharapkan 128, diterima ${res.length}`);
      }
    },
  },
  {
    name: 'Normal 3: createHmacSignature(Buffer(k), Buffer(data))',
    run: (mod) => {
      const res = mod.createHmacSignature(Buffer.from('k'), Buffer.from('data'));
      const expected = crypto.createHmac('sha256', Buffer.from('k')).update(Buffer.from('data')).digest('hex');
      if (res !== expected) {
        throw new Error(`Digest Buffer input tidak sesuai: diterima '${res}', diharapkan '${expected}'`);
      }
    },
  },
  {
    name: 'Edge 1: createHmacSignature(secret-key, "") (empty payload)',
    run: (mod) => {
      const res = mod.createHmacSignature('secret-key', '');
      const expected = crypto.createHmac('sha256', 'secret-key').update('').digest('hex');
      if (res !== expected) {
        throw new Error(`Digest payload string kosong salah: diterima '${res}'`);
      }
    },
  },
  {
    name: 'Edge 2: createHmacSignature(secret-key, Buffer.alloc(0)) (empty Buffer)',
    run: (mod) => {
      const res = mod.createHmacSignature('secret-key', Buffer.alloc(0));
      const expected = crypto.createHmac('sha256', 'secret-key').update(Buffer.alloc(0)).digest('hex');
      if (res !== expected) {
        throw new Error(`Digest payload Buffer kosong salah: diterima '${res}'`);
      }
    },
  },
  {
    name: 'Error 1: secret null melempar TypeError "Secret must be a non-empty string or Buffer"',
    run: (mod) => {
      try {
        mod.createHmacSignature(null, 'data');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Secret must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 2: secret string kosong melempar TypeError',
    run: (mod) => {
      try {
        mod.createHmacSignature('', 'data');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Secret must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 3: secret Buffer kosong melempar TypeError',
    run: (mod) => {
      try {
        mod.createHmacSignature(Buffer.alloc(0), 'data');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Secret must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 4: secret tipe number melempar TypeError',
    run: (mod) => {
      try {
        mod.createHmacSignature(12345, 'data');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Secret must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 5: payload null melempar TypeError "Payload must be a string or Buffer"',
    run: (mod) => {
      try {
        mod.createHmacSignature('secret-key', null);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Payload must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 6: payload tipe number melempar TypeError',
    run: (mod) => {
      try {
        mod.createHmacSignature('secret-key', 999);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Payload must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 7: algorithm null melempar TypeError "Algorithm must be a non-empty string"',
    run: (mod) => {
      try {
        mod.createHmacSignature('secret-key', 'data', null);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Algorithm must be a non-empty string');
      }
    },
  },
  {
    name: 'Error 8: algorithm string kosong melempar TypeError',
    run: (mod) => {
      try {
        mod.createHmacSignature('secret-key', 'data', '');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Algorithm must be a non-empty string');
      }
    },
  },
  {
    name: 'Error 9: algorithm tidak didukung melempar TypeError "Unsupported hash algorithm"',
    run: (mod) => {
      try {
        mod.createHmacSignature('secret-key', 'data', 'invalid-algo-xyz');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Unsupported hash algorithm');
      }
    },
  },
];

// ============================================================================
// DEFINISI TEST SUITE SOAL 02
// ============================================================================
const testsSoal02 = [
  {
    name: 'Normal 1: verifySecretToken string identik mengembalikan true',
    run: (mod) => {
      const res = mod.verifySecretToken('my-secret-token', 'my-secret-token');
      if (res !== true) {
        throw new Error(`Diharapkan true, diterima ${res}`);
      }
    },
  },
  {
    name: 'Normal 2: verifySecretToken Buffer identik mengembalikan true',
    run: (mod) => {
      const res = mod.verifySecretToken(Buffer.from('tok'), Buffer.from('tok'));
      if (res !== true) {
        throw new Error(`Diharapkan true, diterima ${res}`);
      }
    },
  },
  {
    name: 'Normal 3: verifySecretToken konten berbeda panjang sama mengembalikan false',
    run: (mod) => {
      const res = mod.verifySecretToken('secret-token-123', 'wrong-token-999');
      if (res !== false) {
        throw new Error(`Diharapkan false, diterima ${res}`);
      }
    },
  },
  {
    name: 'Edge 1: verifySecretToken panjang berbeda mengembalikan false tanpa error',
    run: (mod) => {
      const res = mod.verifySecretToken('short', 'much-longer-secret-token');
      if (res !== false) {
        throw new Error(`Diharapkan false, diterima ${res}`);
      }
    },
  },
  {
    name: 'Edge 2: verifySecretToken string kosong vs terisi mengembalikan false',
    run: (mod) => {
      const res = mod.verifySecretToken('', 'secret-token');
      if (res !== false) {
        throw new Error(`Diharapkan false, diterima ${res}`);
      }
    },
  },
  {
    name: 'Edge 3: verifySecretToken kedua string kosong mengembalikan true',
    run: (mod) => {
      const res = mod.verifySecretToken('', '');
      if (res !== true) {
        throw new Error(`Diharapkan true, diterima ${res}`);
      }
    },
  },
  {
    name: 'Edge 4: verifySecretToken Buffer vs string dengan konten sama mengembalikan true',
    run: (mod) => {
      const res = mod.verifySecretToken(Buffer.from('token-xyz'), 'token-xyz');
      if (res !== true) {
        throw new Error(`Diharapkan true, diterima ${res}`);
      }
    },
  },
  {
    name: 'Edge 5: verifySecretToken berbeda hanya 1 karakter terakhir mengembalikan false',
    run: (mod) => {
      const res = mod.verifySecretToken('token-abc-1', 'token-abc-2');
      if (res !== false) {
        throw new Error(`Diharapkan false, diterima ${res}`);
      }
    },
  },
  {
    name: 'Error 1: providedToken null melempar TypeError "Provided token must be a string or Buffer"',
    run: (mod) => {
      try {
        mod.verifySecretToken(null, 'secret');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Provided token must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 2: providedToken number melempar TypeError',
    run: (mod) => {
      try {
        mod.verifySecretToken(12345, 'secret');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Provided token must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 3: expectedToken null melempar TypeError "Expected token must be a string or Buffer"',
    run: (mod) => {
      try {
        mod.verifySecretToken('secret', null);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Expected token must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 4: expectedToken object melempar TypeError',
    run: (mod) => {
      try {
        mod.verifySecretToken('secret', {});
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Expected token must be a string or Buffer');
      }
    },
  },
];

// ============================================================================
// DEFINISI TEST SUITE SOAL 03
// ============================================================================
const testsSoal03 = [
  {
    name: 'Normal 1: encrypt plaintext string lalu decrypt mengembalikan plaintext asli',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt('secret-data');
      if (!env || typeof env.ciphertext !== 'string' || typeof env.iv !== 'string' || typeof env.authTag !== 'string') {
        throw new Error('Format envelope encrypt salah');
      }
      if (env.iv.length !== 24 || env.authTag.length !== 32) {
        throw new Error('Panjang hex IV atau authTag tidak sesuai spesifikasi');
      }
      const decrypted = vault.decrypt(env);
      if (decrypted !== 'secret-data') {
        throw new Error(`Hasil dekripsi tidak cocok: diterima '${decrypted}'`);
      }
    },
  },
  {
    name: 'Normal 2: encrypt plaintext Buffer lalu decrypt mengembalikan string UTF-8',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt(Buffer.from('bin-payload'));
      const decrypted = vault.decrypt(env);
      if (decrypted !== 'bin-payload') {
        throw new Error(`Hasil dekripsi Buffer tidak cocok: diterima '${decrypted}'`);
      }
    },
  },
  {
    name: 'Normal 3: encrypt dengan associatedData lalu decrypt dengan AAD yang sama',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt('data-content', 'tenant-aad-meta');
      const decrypted = vault.decrypt(env, 'tenant-aad-meta');
      if (decrypted !== 'data-content') {
        throw new Error(`Hasil dekripsi dengan AAD tidak cocok: diterima '${decrypted}'`);
      }
    },
  },
  {
    name: 'Normal 4: konstruksi EnvelopeVault dengan 64-karakter hex string valid',
    run: (mod) => {
      const hexKey = 'a'.repeat(64);
      const vault = new mod.EnvelopeVault(hexKey);
      const env = vault.encrypt('hex-key-test');
      const decrypted = vault.decrypt(env);
      if (decrypted !== 'hex-key-test') {
        throw new Error(`Dekripsi gagal dengan kunci hex: diterima '${decrypted}'`);
      }
    },
  },
  {
    name: 'Edge 1: ciphertext yang dimanipulasi ditolak dengan Error "Authentication failed:..."',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt('sensitive');
      const tamperedHex = env.ciphertext.slice(0, -2) + (env.ciphertext.endsWith('00') ? 'ff' : '00');
      try {
        vault.decrypt({ ...env, ciphertext: tamperedHex });
        throw new Error('Harus melempar Error otentikasi gagal');
      } catch (err) {
        assertError(err, Error, 'Authentication failed: data has been tampered with or corrupted');
      }
    },
  },
  {
    name: 'Edge 2: authTag yang salah ditolak dengan Error "Authentication failed:..."',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt('sensitive');
      const tamperedTag = env.authTag.slice(0, -2) + (env.authTag.endsWith('00') ? 'ff' : '00');
      try {
        vault.decrypt({ ...env, authTag: tamperedTag });
        throw new Error('Harus melempar Error otentikasi gagal');
      } catch (err) {
        assertError(err, Error, 'Authentication failed: data has been tampered with or corrupted');
      }
    },
  },
  {
    name: 'Edge 3: associatedData tidak cocok ditolak dengan Error "Authentication failed:..."',
    run: (mod) => {
      const key = crypto.randomBytes(32);
      const vault = new mod.EnvelopeVault(key);
      const env = vault.encrypt('sensitive', 'valid-tenant');
      try {
        vault.decrypt(env, 'wrong-tenant');
        throw new Error('Harus melempar Error otentikasi gagal');
      } catch (err) {
        assertError(err, Error, 'Authentication failed: data has been tampered with or corrupted');
      }
    },
  },
  {
    name: 'Error 1: secretKey string tidak valid melempar TypeError "Key must be a 32-byte Buffer or 64-character hex string"',
    run: (mod) => {
      try {
        new mod.EnvelopeVault('too-short-key');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Key must be a 32-byte Buffer or 64-character hex string');
      }
    },
  },
  {
    name: 'Error 2: secretKey Buffer bukan 32 byte melempar TypeError',
    run: (mod) => {
      try {
        new mod.EnvelopeVault(Buffer.alloc(16));
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Key must be a 32-byte Buffer or 64-character hex string');
      }
    },
  },
  {
    name: 'Error 3: encrypt plaintext string kosong melempar TypeError "Plaintext must be a non-empty string or Buffer"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.encrypt('');
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Plaintext must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 4: encrypt plaintext number melempar TypeError',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.encrypt(12345);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Plaintext must be a non-empty string or Buffer');
      }
    },
  },
  {
    name: 'Error 5: encrypt associatedData number melempar TypeError "Associated data must be a string or Buffer"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.encrypt('valid-text', 999);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Associated data must be a string or Buffer');
      }
    },
  },
  {
    name: 'Error 6: decrypt envelope null melempar TypeError "Envelope must be an object"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.decrypt(null);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Envelope must be an object');
      }
    },
  },
  {
    name: 'Error 7: decrypt envelope hilang authTag melempar TypeError "Invalid envelope format"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.decrypt({ ciphertext: 'aa', iv: 'bb' });
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Invalid envelope format');
      }
    },
  },
  {
    name: 'Error 8: decrypt iv dan authTag salah panjang melempar TypeError "Invalid envelope parameters length"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      try {
        vault.decrypt({ ciphertext: 'aa', iv: 'bb', authTag: 'cc' });
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Invalid envelope parameters length');
      }
    },
  },
  {
    name: 'Error 9: decrypt associatedData number melempar TypeError "Associated data must be a string or Buffer"',
    run: (mod) => {
      const vault = new mod.EnvelopeVault(crypto.randomBytes(32));
      const validEnvelope = {
        ciphertext: 'abcd',
        iv: '0123456789abcdef01234567',
        authTag: '0123456789abcdef0123456789abcdef',
      };
      try {
        vault.decrypt(validEnvelope, 12345);
        throw new Error('Harus melempar TypeError');
      } catch (err) {
        assertError(err, TypeError, 'Associated data must be a string or Buffer');
      }
    },
  },
];

const questionRegistry = {
  '01': {
    title: 'Soal 01: HMAC Webhook Signature Generator',
    expectedExport: 'createHmacSignature',
    tests: testsSoal01,
  },
  '02': {
    title: 'Soal 02: Timing-Safe Secret Token Verifier',
    expectedExport: 'verifySecretToken',
    tests: testsSoal02,
  },
  '03': {
    title: 'Soal 03: Authenticated Envelope Vault (AES-256-GCM AEAD)',
    expectedExport: 'EnvelopeVault',
    tests: testsSoal03,
  },
};

async function main() {
  const selectedQuestions = parseCliArgs();
  if (!selectedQuestions) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const prefix of selectedQuestions) {
    const config = questionRegistry[prefix];
    if (!config) continue;

    console.log(`\n================================================================`);
    console.log(`Menjalankan ${config.title}`);
    console.log(`================================================================`);

    const loaded = await loadExerciseModule(prefix);
    if (loaded.error) {
      console.log(`[LOAD ERROR] ${loaded.error}`);
      for (const t of config.tests) {
        console.log(`  FAIL: ${t.name}`);
        console.log(`        Alasan: Modul tidak dapat dimuat`);
        totalFailed++;
      }
      console.log(`\nRingkasan ${config.title}: 0 passed, ${config.tests.length} failed`);
      continue;
    }

    const mod = loaded.module;
    if (typeof mod[config.expectedExport] !== 'function') {
      console.log(`[EXPORT ERROR] Export '${config.expectedExport}' tidak ditemukan atau bukan function/class`);
      for (const t of config.tests) {
        console.log(`  FAIL: ${t.name}`);
        console.log(`        Alasan: Named export '${config.expectedExport}' tidak ditemukan`);
        totalFailed++;
      }
      console.log(`\nRingkasan ${config.title}: 0 passed, ${config.tests.length} failed`);
      continue;
    }

    let qPassed = 0;
    let qFailed = 0;

    for (const t of config.tests) {
      try {
        await runWithTimeout(() => t.run(mod), 2000);
        console.log(`  PASS: ${t.name}`);
        qPassed++;
      } catch (err) {
        console.log(`  FAIL: ${t.name}`);
        console.log(`        Alasan: ${err.message}`);
        qFailed++;
      }
    }

    console.log(`\nRingkasan ${config.title}: ${qPassed} passed, ${qFailed} failed`);
    totalPassed += qPassed;
    totalFailed += qFailed;
  }

  if (selectedQuestions.length > 1) {
    console.log(`\n================================================================`);
    console.log(`TOTAL KESELURUHAN: ${totalPassed} passed, ${totalFailed} failed`);
    console.log(`================================================================`);
  }

  if (totalFailed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

main();
