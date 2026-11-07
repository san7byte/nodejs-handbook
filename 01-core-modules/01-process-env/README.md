# Process & Environment

> Mengelola siklus hidup proses Node.js, membaca konfigurasi environment, menangani argumen CLI, serta memantau kesehatan runtime aplikasi.

## Kenapa Perlu?

Aplikasi backend membutuhkan konfigurasi dinamis (seperti port server dan kredensial database) yang berbeda di setiap lingkungan deployment. Tanpa modul `process`, kita tidak bisa membaca variabel lingkungan sistem, memproses argumen baris perintah, atau menangani sinyal terminasi server dengan aman. Modul ini menyediakan kontrol penuh terhadap proses Node.js yang sedang berjalan.

## Konsep Inti

- `process` adalah objek global bawaan Node.js, disarankan diimpor eksplisit via `import process from 'node:process'`.
- `process.env` menyimpan semua environment variable sistem dan seluruh nilainya bertipe `string`.
- `process.loadEnvFile()` memuat file `.env` secara native tanpa memerlukan library pihak ketiga (Node.js v20.12+).
- `process.argv` menyimpan argumen baris perintah dalam bentuk array, dengan argumen pengguna dimulai dari indeks ke-2.
- `process.exitCode` mengatur status keluar proses secara alami tanpa memutus antrean event loop seketika.

## Langkah 1: Membaca Environment Variables

Kita membaca konfigurasi aplikasi dari variabel lingkungan sistem menggunakan objek `process.env` dan menangani variabel yang belum diset atau bernilai tidak valid.

Buat file `env.mjs`.

```js
import process from 'node:process';

// Normal: read existing variable with fallback
const nodeEnv = process.env.NODE_ENV || 'development';

// Edge-case: missing variable and strict type validation
const rawPort = process.env.PORT;
const port = Number(rawPort);
const isPortValid = Number.isInteger(port) && port >= 1 && port <= 65535;

console.log('Environment:', nodeEnv);
console.log('Raw PORT is undefined:', rawPort === undefined);
console.log('Fallback PORT valid:', isPortValid ? port : 3000);
```

Jalankan file:

```bash
node env.mjs
```

Output:

```
Environment: development
Raw PORT is undefined: true
Fallback PORT valid: 3000
```

Properti `process.env` memuat semua variabel lingkungan sistem sebagai string. Pada kondisi edge-case di mana variabel belum didefinisikan (`undefined`) atau bertipe string kosong, kita wajib menyediakan nilai cadangan (*fallback*) dan memvalidasi tipe data sebelum digunakan oleh server.

## Langkah 2: Memuat File .env Secara Programatik

Kita memuat variabel konfigurasi dari file `.env` langsung ke `process.env` tanpa library eksternal dan menangani error jika berkas konfigurasi tidak ditemukan.

Buat file `.env`:

```
DATABASE_URL=postgres://localhost:5432/app
```

Lalu buat file `load-env.mjs`.

```js
import process from 'node:process';

// Normal: load default .env file
process.loadEnvFile();
console.log('Database URL:', process.env.DATABASE_URL);

// Edge-case: handle missing custom file safely
try {
  process.loadEnvFile('.env.missing');
} catch (err) {
  console.log('Caught missing file error:', err.code);
}
```

Jalankan file:

```bash
node load-env.mjs
```

Output:

```
Database URL: postgres://localhost:5432/app
Caught missing file error: ENOENT
```

Method `process.loadEnvFile()` membaca file `.env` dari direktori kerja aktif dan menyuntikkannya ke `process.env`. Jika path file yang dicari tidak tersedia di sistem berkas, Node.js melempar error dengan kode `ENOENT` yang perlu ditangkap dengan blok `try...catch`.

## Langkah 3: Membaca dan Memvalidasi Argumen CLI

Kita membaca argumen baris perintah dari `process.argv` dan mendeteksi kondisi edge-case saat flag diberikan tanpa menyertakan nilai.

Buat file `args.mjs`.

```js
import process from 'node:process';

const userArgs = process.argv.slice(2);
const portIndex = userArgs.indexOf('--port');
const portValue = portIndex !== -1 ? userArgs[portIndex + 1] : undefined;

// Edge-case: flag exists but value is missing or another flag
const hasValue = portValue !== undefined && !portValue.startsWith('--');
const parsedPort = hasValue ? Number(portValue) : null;
const isValid = parsedPort !== null && Number.isInteger(parsedPort);

console.log('User args:', userArgs);
console.log('Port value provided:', hasValue);
console.log('Resolved port:', isValid ? parsedPort : 3000);
```

Jalankan file dengan flag tanpa nilai:

```bash
node args.mjs --port
```

Output:

```
User args: [ '--port' ]
Port value provided: false
Resolved port: 3000
```

Dua indeks pertama `process.argv` selalu berisi path binary `node` dan path file script. Saat pengguna hanya menuliskan `--port` tanpa nilai berikutnya di terminal, logika pemotongan array mendeteksi bahwa nilai tidak tersedia sehingga aplikasi aman menggunakan fallback port default `3000`.

## Langkah 4: Mengatur Status Keluar Proses

Kita mengatur status keluar proses menggunakan `process.exitCode` untuk kegagalan yang dapat ditoleransi dan `process.exit()` untuk kondisi error fatal darurat.

Buat file `exit.mjs`.

```js
import process from 'node:process';

function shutdown(hasFatalCrash) {
  if (hasFatalCrash) {
    console.error('Fatal crash: emergency exit immediately');
    process.exit(1); // Terminates immediately, skipping pending tasks
  }

  console.warn('Recoverable validation error: setting exitCode');
  process.exitCode = 1; // Allows async operations or event loop to finish cleanly
}

// Edge-case test: recoverable error allows loop to exit naturally
shutdown(false);
console.log('Event loop still alive. ExitCode:', process.exitCode);
```

Jalankan file:

```bash
node exit.mjs
```

Output:

```
Recoverable validation error: setting exitCode
Event loop still alive. ExitCode: 1
```

Mengatur `process.exitCode = 1` memastikan sistem operasi menerima kode status error tanpa menghentikan paksa operasi asynchronous yang sedang berjalan. Sebaliknya, `process.exit(1)` adalah mekanisme darurat (*emergency brake*) yang mematikan proses saat itu juga sehingga operasi I/O yang tertunda akan terputus.

## Langkah 5: Memantau Metrik Runtime dan Benchmark

Kita memantau alokasi memori proses, waktu aktif runtime, dan mengukur durasi eksekusi dengan resolusi tinggi menggunakan `hrtime.bigint()`.

Buat file `metrics.mjs`.

```js
import process from 'node:process';

// 1. Memory and uptime metrics
const mem = process.memoryUsage();
const uptime = process.uptime();
console.log('Heap used exists:', typeof mem.heapUsed === 'number');
console.log('Uptime is number:', typeof uptime === 'number');

// 2. High-resolution benchmark with threshold detection (edge-case)
const start = process.hrtime.bigint();

// Simulate workload
for (let i = 0; i < 500_000; i++) Math.sqrt(i);

const elapsedNs = process.hrtime.bigint() - start;
const elapsedMs = Number(elapsedNs) / 1_000_000;
const isTooSlow = elapsedMs > 200; // Edge-case threshold warning

console.log('Elapsed ms is positive:', elapsedMs > 0);
console.log('Exceeded 200ms threshold:', isTooSlow);
```

Jalankan file:

```bash
node metrics.mjs
```

Output:

```
Heap used exists: true
Uptime is number: true
Elapsed ms is positive: true
Exceeded 200ms threshold: false
```

Method `process.memoryUsage()` dan `process.uptime()` memantau kondisi kesehatan runtime. Sementara itu, `process.hrtime.bigint()` mengembalikan waktu berpresisi nanodetik yang monotonic (bebas dari penyesuaian jam sistem operasi) sehingga akurat untuk mendeteksi operasi yang melebihi batas durasi aman (*threshold*).

## Langkah 6: Menangani Sinyal dan Lifecycle Event

Kita mendaftarkan penangan sinyal sistem operasi dan menangkap kejadian fatal tak tertangani (*unhandled events*) agar aplikasi tidak crash tanpa catatan log.

Buat file `events.mjs`.

```js
import process from 'node:process';

// 1. Handling POSIX signal
process.on('SIGINT', (signal) => {
  console.log('Received signal:', signal);
});

// 2. Edge-case: intercepting unhandled Promise rejection
process.on('unhandledRejection', (reason) => {
  console.error('Handled unhandledRejection safely:', reason.message);
  process.exitCode = 1;
});

// Test signal
process.emit('SIGINT', 'SIGINT');

// Test edge-case rejection
const rejectedPromise = Promise.reject(new Error('Database connection failed'));
process.emit('unhandledRejection', new Error('Database connection failed'), rejectedPromise);
rejectedPromise.catch(() => {});
```

Jalankan file:

```bash
node events.mjs
```

Output:

```
Received signal: SIGINT
Handled unhandledRejection safely: Database connection failed
```

Method `process.on()` mendaftarkan callback untuk sinyal sistem operasi seperti `SIGINT` (Ctrl+C). Event `unhandledRejection` berfungsi sebagai jaring pengaman terakhir untuk menangkap Promise yang gagal dieksekusi tanpa blok `.catch()`, mencatat diagnostik error, dan menandai `process.exitCode = 1`.

## Referensi API

| API | Fungsi |
|---|---|
| `process.env` | Objek kamus variabel lingkungan sistem operasi. |
| `process.loadEnvFile(path?)` | Memuat file `.env` ke `process.env`. `path` (string, opsional, default: `'.env'`). Returns `void`. |
| `process.argv` | Array argumen baris perintah. `[0]` path binary node, `[1]` path script, `[2..]` argumen pengguna. Returns `string[]`. |
| `process.exitCode` | Mengatur exit code proses saat event loop selesai. `number`, default `0`. |
| `process.exit(code?)` | Menghentikan proses seketika. `code` (number, opsional, default `0`). Returns `never`. |
| `process.memoryUsage()` | Mengembalikan statistik memori proses (RSS, heapTotal, heapUsed, external). Returns `object`. |
| `process.uptime()` | Mengembalikan durasi proses berjalan dalam detik. Returns `number`. |
| `process.hrtime.bigint()` | Mengukur waktu resolusi tinggi dalam nanodetik untuk benchmark. Returns `bigint`. |
| `process.on(event, listener)` | Mendaftarkan listener event atau sinyal OS. `event` (string, wajib), `listener` (function, wajib). Returns `process`. |

## Kasus di Aplikasi

Di backend, penanganan sinyal terminasi sistem operasi wajib diterapkan saat aplikasi dideploy di container (seperti Docker atau Kubernetes) agar proses dapat menyelesaikan request yang sedang berjalan sebelum dimatikan.

**Masalah:** Saat container di-deploy ulang atau dihentikan, proses menerima sinyal `SIGTERM`. Jika sinyal tidak ditangani, koneksi HTTP aktif akan terputus paksa sehingga client menerima error 502 Bad Gateway.

**Solusi:** Pasang listener `SIGTERM` dan `SIGINT` untuk menutup server HTTP dengan `server.close()`, selesaikan request aktif, dan sediakan timeout penghenti paksa jika cleanup menggantung.

```js
import http from 'node:http';
import process from 'node:process';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server ready');
});

let isShuttingDown = false;

function setupGracefulShutdown(server) {
  function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Received ${signal}. Closing server...`);

    const forceTimer = setTimeout(() => {
      console.error('Force shutdown after timeout.');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    server.close(() => {
      console.log('HTTP server closed cleanly.');
      process.exitCode = 0;
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

setupGracefulShutdown(server);

server.listen(0, () => {
  console.log('Server is listening.');
  process.emit('SIGTERM');
});
```

## Pitfalls

- Mengira tipe nilai di `process.env` adalah number atau boolean. Semua variabel lingkungan selalu bertipe string.
  ```js
  // ❌ Incorrect: '8080' + 1 produces '80801'
  const port = process.env.PORT + 1;

  // ✅ Correct: explicitly convert to number
  const port = Number(process.env.PORT) || 8080;
  ```
- Memanggil `process.exit()` di tengah operasi asynchronous yang belum selesai.
  ```js
  // ❌ Incorrect: terminates process before async task finishes
  saveToDatabase();
  process.exit(1);

  // ✅ Correct: wait for promises or set process.exitCode
  await saveToDatabase();
  process.exitCode = 0;
  ```
- Menjalankan container Node.js dengan shell form (`CMD npm start`) sehingga proses tidak menerima sinyal `SIGTERM` dari Docker.
  ```dockerfile
  # ❌ Incorrect: shell form wraps process in /bin/sh which ignores SIGTERM
  CMD npm start

  # ✅ Correct: exec form runs Node directly as PID 1
  CMD ["node", "src/server.mjs"]
  ```
- Menangani `uncaughtException` lalu membiarkan proses tetap berjalan normal dengan state memori yang berpotensi rusak.
  ```js
  // ❌ Incorrect: continuing execution after uncaught exception
  process.on('uncaughtException', (err) => {
    console.error('Error occurred:', err.message);
  });

  // ✅ Correct: log diagnostic info, set exitCode, and exit cleanly
  process.on('uncaughtException', (err) => {
    console.error('Fatal crash, shutting down:', err);
    process.exitCode = 1;
  });
  ```

## Referensi

- [Node.js Docs: Process](https://nodejs.org/api/process.html)
- [Node.js Docs: HTTP](https://nodejs.org/api/http.html) — modul server pendukung yang digunakan pada implementasi graceful shutdown di Kasus di Aplikasi

---

Berikutnya: [02 - Path & URL](../02-path-url/README.md)
