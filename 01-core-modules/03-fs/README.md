# File System

> Mengelola operasi berkas dan direktori secara asinkron berbasis Promise, mulai dari manipulasi konten, inspeksi metadata, hingga pengelolaan FileHandle.

## Kenapa Perlu?

Aplikasi backend secara terus-menerus berinteraksi dengan sistem berkas untuk menyimpan unggahan pengguna, membaca konfigurasi runtime, mencatat berkas log, dan memproses data biner. Tanpa modul `node:fs/promises`, eksekusi I/O disk yang lambat dan bersifat sinkron dapat memblokir thread event loop utama sehingga seluruh request HTTP lain ikut terhenti. Modul ini menyediakan antarmuka asinkron modern untuk membaca, menulis, memvalidasi metadata, serta memanipulasi struktur direktori secara non-blocking dan aman.

## Konsep Inti

- Selalu gunakan `node:fs/promises` untuk operasi non-blocking berbasis `async/await` di server produksi, hindari varian sinkron (`fs.*Sync`).
- Impor modul secara eksplisit menggunakan skema protokol Node: `import fs from 'node:fs/promises'`.
- Path relatif pada operasi `fs` selalu diselesaikan terhadap Current Working Directory (`process.cwd()`), bukan direktori script; gunakan `import.meta.url` atau objek `URL` jika ingin path absolut yang terikat pada lokasi modul.
- Operasi filesystem melempar error dengan kode standar POSIX seperti `'ENOENT'` (berkas/folder tidak ditemukan), `'EEXIST'` (target sudah ada), dan `'EBADF'` (deskriptor berkas tidak valid).
- Hindari method usang (*deprecated*) seperti `fs.exists()`; gunakan `fs.stat()` atau tangkap langsung error `ENOENT` pada blok `try...catch`.
- Untuk menjaga integritas berkas penting dari kegagalan proses di tengah jalan, terapkan pola penulisan *atomic write* melalui `fs.rename()`.

## Langkah 1: Membaca, Menulis, dan Menambahkan Konten Berkas

Kita membuat berkas baru, menambahkan data baris baru, membaca seluruh konten teks, serta menangani error saat berkas target tidak ditemukan atau diproteksi flag penulisan.

Buat file `file-crud.mjs`.

```js
import fs from 'node:fs/promises';

// Normal: write data and read back as utf-8 string
const filePath = 'note.txt';
await fs.writeFile(filePath, 'Initial note content.\n', 'utf8');
await fs.appendFile(filePath, 'Appended log entry.\n', 'utf8');

const content = await fs.readFile(filePath, 'utf8');
console.log('File content:\n' + content.trim());

// Edge-case: handle missing file safely (ENOENT) and prevent overwrite flag ('wx')
try {
  await fs.readFile('non-existent.txt', 'utf8');
} catch (err) {
  console.log('Caught missing file code:', err.code);
}

try {
  // 'wx' flag fails if path already exists
  await fs.writeFile(filePath, 'Should fail', { flag: 'wx' });
} catch (err) {
  console.log('Caught overwrite prevention code:', err.code);
}

// Cleanup
await fs.unlink(filePath);
```

Jalankan file:

```bash
node file-crud.mjs
```

Output:

```
File content:
Initial note content.
Appended log entry.
Caught missing file code: ENOENT
Caught overwrite prevention code: EEXIST
```

Method `fs.writeFile()` membuat berkas baru atau menimpa berkas yang sudah ada, sedangkan `fs.appendFile()` menyisipkan data di baris akhir tanpa menghapus isi sebelumnya. Nama berkas relatif seperti `'note.txt'` secara default diselesaikan terhadap direktori kerja terminal aktif (`process.cwd()`). Menggunakan flag `'wx'` secara defensif memastikan penulisan gagal dengan kode `'EEXIST'` jika berkas sudah ada sebelumnya, dan pembacaan berkas yang tidak tersedia memicu error dengan kode `'ENOENT'`.

## Langkah 2: Mengelola dan Menjelajahi Struktur Direktori

Kita membuat struktur folder bersarang secara otomatis dan membaca daftar entri direktori beserta identifikasi tipe berkasnya.

Buat file `directory-ops.mjs`.

```js
import fs from 'node:fs/promises';

const dir = 'temp-project/subfolder';
await fs.mkdir(dir, { recursive: true });

await fs.writeFile('temp-project/file-a.txt', 'A');
await fs.writeFile('temp-project/subfolder/file-b.txt', 'B');

// Normal: read directory entries with types
const entries = await fs.readdir('temp-project', { withFileTypes: true });
for (const entry of entries) {
  console.log(`Entry: ${entry.name} (isDir: ${entry.isDirectory()})`);
}

// Edge-case: mkdir without recursive flag on nested path throws ENOENT
try {
  await fs.mkdir('missing-root/deep/folder');
} catch (err) {
  console.log('Caught non-recursive mkdir code:', err.code);
}

// Edge-case: readdir on missing directory throws ENOENT
try {
  await fs.readdir('missing-dir');
} catch (err) {
  console.log('Caught missing dir code:', err.code);
}

// Cleanup
await fs.rm('temp-project', { recursive: true, force: true });
```

Jalankan file:

```bash
node directory-ops.mjs
```

Output:

```
Entry: file-a.txt (isDir: false)
Entry: subfolder (isDir: true)
Caught non-recursive mkdir code: ENOENT
Caught missing dir code: ENOENT
```

Opsi `{ recursive: true }` pada `fs.mkdir()` berfungsi seperti perintah `mkdir -p` di terminal: jika folder induknya belum ada (misal membuat `temp-project/subfolder`), Node.js otomatis membuat folder induknya terlebih dahulu, dan tidak akan error jika foldernya sudah ada. Memberikan opsi `{ withFileTypes: true }` pada `fs.readdir()` mengembalikan array objek `fs.Dirent` sehingga kita dapat langsung mengecek status entri via `entry.isDirectory()` tanpa perlu memanggil `fs.stat()` terpisah.

## Langkah 3: Memeriksa Metadata dan Status Berkas

Kita membaca statistik berkas seperti ukuran biner dan tipe objek, serta memverifikasi keberadaan berkas secara aman tanpa fungsi deprecated.

Buat file `file-stats.mjs`.

```js
import fs from 'node:fs/promises';

const sampleFile = 'metadata-sample.txt';
await fs.writeFile(sampleFile, 'Standard buffer payload', 'utf8');

// Normal: inspect file metadata
const stats = await fs.stat(sampleFile);
console.log('Is file:', stats.isFile());
console.log('Is directory:', stats.isDirectory());
console.log('Byte size:', stats.size);
console.log('Valid mtime:', typeof stats.mtimeMs === 'number');

// Edge-case: verify file existence safely via try-catch (replaces deprecated fs.exists)
async function fileExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

console.log('Sample exists:', await fileExists(sampleFile));
console.log('Missing exists:', await fileExists('non-existent.bin'));

// Cleanup
await fs.unlink(sampleFile);
```

Jalankan file:

```bash
node file-stats.mjs
```

Output:

```
Is file: true
Is directory: false
Byte size: 23
Valid mtime: true
Sample exists: true
Missing exists: false
```

Method `fs.stat()` mengembalikan objek `fs.Stats` yang memuat informasi kapasitas byte (`stats.size`), timestamp modifikasi terakhir (`stats.mtimeMs`), serta method verifikasi tipe seperti `stats.isFile()`. Karena fungsi `fs.exists()` telah lama dihentikan dukungannya (*deprecated*), pola verifikasi keberadaan berkas standar industri dilakukan melalui blok `try...catch` yang secara spesifik menyaring kode error `ENOENT`.

## Langkah 4: Menyalin, Mengubah Nama, dan Menghapus Berkas atau Direktori

Kita menyalin berkas dengan proteksi overwrite, mengubah nama atau memindahkan path, serta menghapus berkas dan direktori bertingkat secara bersih.

Buat file `file-cleanup.mjs`.

```js
import fs from 'node:fs/promises';
import { constants } from 'node:fs';

const srcFile = 'source.txt';
const copyTarget = 'target.txt';
const renamedFile = 'renamed.txt';
const testDir = 'temp-cleanup-tree';

await fs.writeFile(srcFile, 'Payload to copy', 'utf8');

// Normal: copy, rename, and unlink
await fs.copyFile(srcFile, copyTarget);
await fs.rename(copyTarget, renamedFile);
await fs.unlink(renamedFile);
console.log('Copy, rename, and unlink completed.');

// Edge-case: COPYFILE_EXCL prevents accidental destination overwrite
await fs.writeFile(copyTarget, 'Existing file', 'utf8');
try {
  await fs.copyFile(srcFile, copyTarget, constants.COPYFILE_EXCL);
} catch (err) {
  console.log('Caught copy destination exists code:', err.code);
}

// Edge-case: rm with force: true safely ignores missing targets
await fs.mkdir(testDir, { recursive: true });
await fs.rm(testDir, { recursive: true, force: true });
await fs.rm('non-existent-folder', { recursive: true, force: true });
console.log('Force removal completed without error.');

// Cleanup
await fs.unlink(srcFile);
await fs.unlink(copyTarget);
```

Jalankan file:

```bash
node file-cleanup.mjs
```

Output:

```
Copy, rename, and unlink completed.
Caught copy destination exists code: EEXIST
Force removal completed without error.
```

Konstanta `constants.COPYFILE_EXCL` pada `fs.copyFile()` menghentikan operasi penyalinan dengan kode `EEXIST` jika file target sudah ada di disk. Untuk menghapus folder bersarang beserta seluruh isinya atau berkas yang belum tentu ada, gunakan `fs.rm()` dengan kombinasi `{ recursive: true, force: true }` agar operasi berjalan mulus tanpa melempar exception saat path tujuan sudah tidak ada.

## Langkah 5: Membaca Sebagian Berkas dengan FileHandle

Kita membuka berkas menggunakan `fs.open()` untuk membaca sebagian data saja (misalnya hanya membaca beberapa byte awal tanpa memuat seluruh berkas ke RAM), lalu selalu menutupnya di blok `finally` agar file handle tidak bocor.

Buat file `file-handle.mjs`.

```js
import fs from 'node:fs/promises';

const filePath = 'descriptor-sample.bin';
await fs.writeFile(filePath, 'HEADER_CONTENT_DATA', 'utf8');

// Normal: open handle, read partial buffer, and close in finally
let handle;
try {
  handle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(6);
  const { bytesRead } = await handle.read(buffer, 0, 6, 0);
  console.log('Bytes read:', bytesRead);
  console.log('Header text:', buffer.toString('utf8'));
} finally {
  await handle?.close();
}

// Edge-case: reading from closed handle throws error
try {
  const dummyBuf = Buffer.alloc(4);
  await handle.read(dummyBuf, 0, 4, 0);
} catch (err) {
  console.log('Caught closed handle code:', err.code);
}

// Cleanup
await fs.unlink(filePath);
```

Jalankan file:

```bash
node file-handle.mjs
```

Output:

```
Bytes read: 6
Header text: HEADER
Caught closed handle code: EBADF
```

Method `fs.open()` mengembalikan objek `FileHandle` yang berguna saat kita hanya ingin membaca sebagian isi berkas (seperti membaca header atau beberapa byte awal) tanpa harus memuat seluruh berkas ke RAM. Objek `FileHandle` ini wajib selalu ditutup dengan `handle.close()` di dalam blok `finally` agar tidak membebani sistem operasi (*resource leak*). Jika kita mencoba membaca handle yang sudah ditutup, Node.js melempar error `EBADF` (*Bad file descriptor*).

## Referensi API

| API | Fungsi |
|---|---|
| `fs.readFile(path, options?)` | Membaca seluruh konten berkas ke memori. `path` (string \| Buffer \| URL, wajib), `options` (string \| object, opsional, default: `undefined`). Returns `Promise<string \| Buffer>`. |
| `fs.writeFile(file, data, options?)` | Menulis data ke berkas target. `file` (string \| Buffer \| URL, wajib), `data` (string \| Buffer \| TypedArray, wajib), `options` (string \| object, opsional, default: `'utf8'`). Returns `Promise<void>`. |
| `fs.appendFile(path, data, options?)` | Menambahkan data ke akhir berkas. `path` (string \| Buffer \| URL, wajib), `data` (string \| Buffer, wajib), `options` (string \| object, opsional, default: `'utf8'`). Returns `Promise<void>`. |
| `fs.mkdir(path, options?)` | Membuat direktori baru di sistem berkas. `path` (string \| Buffer \| URL, wajib), `options` (object, opsional: `{ recursive, mode }`, default: `{ recursive: false }`). Returns `Promise<string \| undefined>`. |
| `fs.readdir(path, options?)` | Membaca daftar entri direktori. `path` (string \| Buffer \| URL, wajib), `options` (string \| object, opsional: `{ withFileTypes, recursive }`, default: `'utf8'`). Returns `Promise<string[] \| Dirent[]>`. |
| `fs.stat(path, options?)` | Memeriksa metadata dan status berkas. `path` (string \| Buffer \| URL, wajib), `options` (object, opsional: `{ bigint }`, default: `{ bigint: false }`). Returns `Promise<fs.Stats>`. |
| `fs.copyFile(src, dest, mode?)` | Menyalin berkas dari sumber ke tujuan. `src` (string \| URL, wajib), `dest` (string \| URL, wajib), `mode` (number, opsional, default: `0`). Returns `Promise<void>`. |
| `fs.rename(oldPath, newPath)` | Mengubah nama atau memindahkan berkas secara atomik. `oldPath` (string \| URL, wajib), `newPath` (string \| URL, wajib). Returns `Promise<void>`. |
| `fs.unlink(path)` | Menghapus berkas tunggal dari sistem berkas. `path` (string \| Buffer \| URL, wajib). Returns `Promise<void>`. |
| `fs.rm(path, options?)` | Menghapus berkas atau folder bersarang beserta isinya secara rekursif. `path` (string \| URL, wajib), `options` (object, opsional: `{ recursive, force, maxRetries }`, default: `{ recursive: false, force: false }`). Returns `Promise<void>`. |
| `fs.open(path, flags?, mode?)` | Membuka berkas untuk operasi tingkat lanjut dan mengembalikan objek `FileHandle`. `path` (string \| URL, wajib), `flags` (string \| number, opsional, default: `'r'`), `mode` (number, opsional, default: `0o666`). Returns `Promise<FileHandle>`. |

## Kasus di Aplikasi

Di backend, penulisan berkas konfigurasi, state runtime, atau berkas database lokal wajib dilindungi dari kegagalan daya atau crash proses agar file utama tidak terpotong setengah atau rusak.

**Masalah:** Pemadaman listrik, crash runtime, atau terminasi container saat `fs.writeFile()` sedang berlangsung menyebabkan berkas target berukuran 0-byte atau JSON rusak (*corrupted JSON*), sehingga server gagal restart.

**Solusi:** Terapkan pola *atomic write*: tulis konten baru ke berkas sementara dengan ID unik di direktori yang sama, lalu timpa berkas konfigurasi utama secara instan menggunakan `fs.rename()`.

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

async function safeSave(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}`);
  const payload = JSON.stringify(data, null, 2);

  // Write to temporary file first
  await fs.writeFile(tempPath, payload, 'utf8');

  // Atomically replace target file in the same filesystem
  await fs.rename(tempPath, filePath);
}

const target = path.resolve('config.json');

try {
  await safeSave(target, { server: 'primary', port: 8080, active: true });
  const raw = await fs.readFile(target, 'utf8');
  const parsed = JSON.parse(raw);
  console.log('Saved server:', parsed.server);
  console.log('Saved port:', parsed.port);
} finally {
  await fs.unlink(target).catch(() => {});
}
```

## Pitfalls

- Menggunakan `fs.readFile()` untuk berkas berukuran raksasa (multi-gigabyte). Seluruh konten dimuat sekaligus ke RAM dan memicu crash *heap out of memory*; gunakan Readable Stream (`node:fs` `createReadStream`) untuk data besar.
  ```js
  // ❌ Incorrect: loads entire multi-gigabyte file into RAM
  const buffer = await fs.readFile('huge-dataset.csv');

  // ✅ Correct: streams file chunk-by-chunk with low memory footprint
  import { createReadStream } from 'node:fs';
  const stream = createReadStream('huge-dataset.csv');
  ```
- Memeriksa keberadaan berkas dengan `fs.exists()` atau `fs.existsSync()` sebelum membacanya. Pola ini usang (*deprecated*) dan menimbulkan kerentanan *race condition* (TOCTOU: Time-of-check to time-of-use).
  ```js
  // ❌ Incorrect: deprecated and vulnerable to race conditions
  if (fs.existsSync('config.json')) {
    const data = await fs.readFile('config.json', 'utf8');
  }

  // ✅ Correct: read directly and handle ENOENT defensively in try-catch
  try {
    const data = await fs.readFile('config.json', 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') console.log('File does not exist');
  }
  ```
- Menimpa berkas konfigurasi sistem secara langsung dengan `fs.writeFile()` tanpa pola *atomic write*. Jika proses mati mendadak saat I/O berlangsung, file menjadi kosong atau rusak.
  ```js
  // ❌ Incorrect: direct overwrite leaves file corrupted if process terminates mid-write
  await fs.writeFile('app-state.json', JSON.stringify(state), 'utf8');

  // ✅ Correct: write to temporary file first, then atomically rename
  const tmpFile = `app-state.json.tmp-${crypto.randomUUID()}`;
  await fs.writeFile(tmpFile, JSON.stringify(state), 'utf8');
  await fs.rename(tmpFile, 'app-state.json');
  ```
- Lupa memanggil `handle.close()` pada objek `FileHandle` di dalam blok `finally`. Hal ini memicu kebocoran *file descriptor* (*resource leak*) hingga sistem operasi menolak pembukaan berkas baru dengan error `EMFILE`.
  ```js
  // ❌ Incorrect: handle remains open if error occurs during read
  const handle = await fs.open('log.bin', 'r');
  await handle.read(buf, 0, 10, 0);
  await handle.close();

  // ✅ Correct: guarantee handle cleanup using finally block
  let handle;
  try {
    handle = await fs.open('log.bin', 'r');
    await handle.read(buf, 0, 10, 0);
  } finally {
    await handle?.close();
  }
  ```
- Menggunakan relative path mentah (`'config.json'`) dengan asumsi otomatis relatif terhadap lokasi file script. Di Node.js, relative path diselesaikan terhadap direktori kerja terminal saat perintah dijalankan (`process.cwd()`), sehingga jika dieksekusi dari direktori lain, operasi I/O akan salah sasaran atau memicu error `ENOENT`.
  ```js
  // ❌ Incorrect: relative path resolves against process.cwd(), failing when executed from other folders
  const data = await fs.readFile('config.json', 'utf8');

  // ✅ Correct: bind path relative to current module file location
  const targetUrl = new URL('./config.json', import.meta.url);
  const data = await fs.readFile(targetUrl, 'utf8');
  ```

## Referensi

- [Node.js Docs: File System](https://nodejs.org/api/fs.html)
- [Node.js Docs: Path](https://nodejs.org/api/path.html) — modul resolusi path sistem berkas yang digunakan pada penentuan direktori dan penyusunan path berkas sementara di Kasus di Aplikasi
- [Node.js Docs: Crypto](https://nodejs.org/api/crypto.html) — modul pembangkit ID acak unik (`crypto.randomUUID()`) yang digunakan pada penamaan berkas sementara di Kasus di Aplikasi
- [Node.js Docs: URL](https://nodejs.org/api/url.html) — modul standar WHATWG URL yang digunakan bersama `import.meta.url` untuk penguncian path berkas absolut lintas platform

---

Berikutnya: [04 - Events](../04-events/README.md)
