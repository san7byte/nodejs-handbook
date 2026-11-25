# Timers & Async

> Mengatur penjadwalan eksekusi kode asinkron, memahami antrean fase Event Loop, serta melacak konteks eksekusi antar pemanggilan asynchronous menggunakan AsyncLocalStorage.

## Kenapa Perlu?

Aplikasi backend menangani ribuan operasi I/O konkuren secara non-blocking dengan mengandalkan penjadwalan waktu dan event loop. Tanpa pemahaman timers yang tepat, kode rawan memblokir thread utama, memicu race condition, atau mengalami kebocoran memori dari interval yang tidak dibersihkan. Selain itu, melacak metadata seperti request ID atau identitas pengguna di seluruh rantai panggilan asinkron memerlukan mekanisme propagasi konteks otomatis agar tidak mengotori kode dengan pengiriman parameter berulang (*prop drilling*).

## Konsep Inti

- Event Loop Libuv memproses tugas dalam fase teratur: Timers (`setTimeout`/`setInterval`), Pending Callbacks, Poll (I/O), Check (`setImmediate`), dan Close Callbacks.
- Microtask queue (`process.nextTick` dan Promise / `queueMicrotask`) dieksekusi sebelum event loop beralih ke fase macrotask berikutnya. Di dalam callback, `process.nextTick` selalu menguras antrean mendahului V8 microtask; namun di top-level ES Module (`.mjs`), evaluasi modul berjalan di dalam V8 promise job sehingga `queueMicrotask` diproses lebih dulu.
- Modul `node:timers/promises` menyediakan fungsi timer berbasis `Promise` modern yang mendukung integrasi `await` serta pembatalan melalui `AbortSignal`.
- Objek timer native memiliki method `.unref()` agar timer di latar belakang tidak menahan proses Node.js untuk keluar saat semua antrean kerja selesai.
- `AsyncLocalStorage` dari `node:async_hooks` memungkinkan penyimpanan dan pembacaan state kontekstual yang konsisten di seluruh alur asinkron tanpa *prop drilling*.

## Langkah 1: Mengatur Timer Callback dan Mengendalikan Siklus Hidup Proses

Kita menjadwalkan timer penundaan dan pengulangan, membersihkan timer aktif, serta menggunakan method `.unref()` agar timer latar belakang tidak menahan proses Node.js.

Buat file `timeout-lifecycle.mjs`.

```js
import { setTimeout, clearTimeout, setInterval, clearInterval } from 'node:timers';

// Normal: schedule timeout with additional parameters
const timer = setTimeout((label, value) => {
  console.log(`Timeout executed: ${label} = ${value}`);
}, 50, 'status', 200);

// Normal: schedule interval and clear it after two iterations
let counter = 0;
const interval = setInterval(() => {
  counter += 1;
  console.log(`Interval tick: ${counter}`);
  if (counter >= 2) {
    clearInterval(interval);
    console.log('Interval cleared cleanly');
  }
}, 40);

// Edge-case: cancel pending timer before execution
const canceledTimer = setTimeout(() => {
  console.log('This will not execute');
}, 30);
clearTimeout(canceledTimer);
console.log('Canceled timer successfully');

// Edge-case: unref background timer so it does not keep Node.js process alive
const backgroundTimer = setTimeout(() => {
  console.log('Background task running');
}, 5000);
backgroundTimer.unref();
console.log('Background timer unreferenced');
```

Jalankan file:

```bash
node timeout-lifecycle.mjs
```

Output:

```
Canceled timer successfully
Background timer unreferenced
Interval tick: 1
Timeout executed: status = 200
Interval tick: 2
Interval cleared cleanly
```

Fungsi `setTimeout` dan `setInterval` menjadwalkan eksekusi callback pada fase Timers. Pemanggilan `clearTimeout` menghapus timer sebelum sempat dieksekusi, sementara `backgroundTimer.unref()` memberitahu event loop bahwa timer tersebut tidak wajib ditunggu jika antrean tugas lain sudah selesai.

## Langkah 2: Memahami Fase Event Loop dan Prioritas Microtask

Kita mengamati urutan eksekusi antrean microtask (`process.nextTick` dan `queueMicrotask`) terhadap macrotask (`setImmediate` dan `setTimeout`), serta membatalkan immediate callback sebelum dieksekusi.

Buat file `event-loop.mjs`.

```js
import process from 'node:process';

console.log('1. Synchronous START');

// Normal: schedule immediate callback executed during the Check phase
setImmediate(() => {
  console.log('4. setImmediate callback start');

  // Normal: microtask queue inside callback
  queueMicrotask(() => {
    console.log('6. queueMicrotask inside immediate');
  });

  // Normal: high-priority tick queue executed before next microtasks
  process.nextTick(() => {
    console.log('5. process.nextTick inside immediate (runs before queueMicrotask)');
  });
});

// Normal: macrotask timer executed after duration elapsed
setTimeout(() => {
  console.log('7. setTimeout completed');
}, 10);

// Edge-case: cancel immediate before entering Check phase
const canceledImmediate = setImmediate(() => {
  console.log('This will not execute');
});
clearImmediate(canceledImmediate);
console.log('2. clearImmediate canceled successfully');

console.log('3. Synchronous END');
```

Jalankan file:

```bash
node event-loop.mjs
```

Output:

```
1. Synchronous START
2. clearImmediate canceled successfully
3. Synchronous END
4. setImmediate callback start
5. process.nextTick inside immediate (runs before queueMicrotask)
6. queueMicrotask inside immediate
7. setTimeout completed
```

Kode sinkron selalu berjalan hingga tuntas terlebih dahulu. Di dalam callback fase Check, `process.nextTick` diproses seketika mendahului antrean `queueMicrotask` Promise karena Node.js selalu menguras `nextTickQueue` sebelum V8 microtasks (pada *top-level* `.mjs`, `queueMicrotask` dapat berjalan lebih dulu karena berkas dievaluasi di dalam V8 Promise job). Pemanggilan `clearImmediate` berhasil membatalkan callback terjadwal sebelum event loop mengeksekusinya.

## Langkah 3: Menggunakan Timers Berbasis Promise dan Pembatalan dengan AbortSignal

Kita menunda alur kerja asinkron menggunakan modul `node:timers/promises` yang kompatibel dengan sintaks `await` dan menangani error pembatalan timer secara terstruktur.

Buat file `promise-timers.mjs`.

```js
import { setTimeout, setImmediate } from 'node:timers/promises';

console.log('1. Starting promise timers');

// Normal: await setTimeout resolving payload value
const result = await setTimeout(30, 'Resolved payload');
console.log('2. setTimeout resolved:', result);

// Normal: await setImmediate yielding to Check phase asynchronously
const immediateResult = await setImmediate('Immediate ready');
console.log('3. setImmediate resolved:', immediateResult);

// Edge-case: abort timer promise using AbortController
const controller = new AbortController();
const timeoutPromise = setTimeout(100, 'Never reached', { signal: controller.signal });

controller.abort();

try {
  await timeoutPromise;
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('4. Caught expected timer cancellation: AbortError');
  } else {
    throw err;
  }
}
```

Jalankan file:

```bash
node promise-timers.mjs
```

Output:

```
1. Starting promise timers
2. setTimeout resolved: Resolved payload
3. setImmediate resolved: Immediate ready
4. Caught expected timer cancellation: AbortError
```

Fungsi `setTimeout` dari `node:timers/promises` mengembalikan Promise yang me-resolve nilai payload setelah durasi waktu terpenuhi. Saat opsi `{ signal }` diberikan dan controller memanggil `.abort()`, Promise segera melempar error dengan nama `AbortError` yang wajib ditangkap menggunakan blok `try...catch`.

## Langkah 4: Menangani Interval Berulang Menggunakan Async Iterator

Kita mengonsumsi interval berkala sebagai aliran data asinkron (*async iterable stream*) menggunakan loop `for await...of` serta menghentikan pemrosesan stream dari luar menggunakan `AbortSignal`.

Buat file `interval-stream.mjs`.

```js
import { setInterval } from 'node:timers/promises';

console.log('1. Starting interval stream');

// Normal: consume interval timer stream using for await...of with break
let count = 0;
for await (const timestamp of setInterval(25, Date.now())) {
  count += 1;
  console.log(`2. Stream tick ${count} at: ${typeof timestamp}`);
  if (count >= 2) {
    break;
  }
}
console.log('3. Stream exited with break cleanly');

// Edge-case: cancel interval stream using an external AbortSignal
const controller = new AbortController();
const signal = controller.signal;

try {
  let abortCount = 0;
  for await (const tick of setInterval(20, 'signal-tick', { signal })) {
    abortCount += 1;
    console.log(`4. Abort stream tick: ${abortCount}`);
    if (abortCount >= 1) {
      controller.abort();
    }
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('5. Handled interval stream abort safely');
  } else {
    throw err;
  }
}
```

Jalankan file:

```bash
node interval-stream.mjs
```

Output:

```
1. Starting interval stream
2. Stream tick 1 at: number
2. Stream tick 2 at: number
3. Stream exited with break cleanly
4. Abort stream tick: 1
5. Handled interval stream abort safely
```

Fungsi `setInterval` dari `node:timers/promises` menghasilkan AsyncIterator yang memancarkan nilai baru pada setiap interval waktu. Iterasi dapat dihentikan secara internal dengan pernyataan `break`, atau dibatalkan dari pemicu luar menggunakan `AbortController` yang membangkitkan `AbortError`.

## Langkah 5: Melacak State Kontekstual Asinkron dengan AsyncLocalStorage

Kita meneruskan context data (seperti identitas request) ke fungsi-fungsi bersarang tanpa melewatkannya sebagai argumen, serta mengisolasi scope konteks menggunakan method `.exit()`.

Buat file `als.mjs`.

```js
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';

const als = new AsyncLocalStorage();

// Normal: access context inside nested functions without prop drilling
async function fetchUserOrders() {
  const store = als.getStore();
  const traceId = store?.get('traceId') ?? 'UNTRACKED';
  await setTimeout(20);
  return `Orders retrieved for trace: ${traceId}`;
}

// Normal: run asynchronous execution within a context Map store
const result = await als.run(new Map([['traceId', 'TRACE-987']]), async () => {
  const store = als.getStore();
  console.log('1. Inside context store:', store.get('traceId'));
  const orders = await fetchUserOrders();
  console.log('2.', orders);

  // Edge-case: isolate execution and clear active store using als.exit()
  const isolated = als.exit(() => {
    const outsideStore = als.getStore();
    return outsideStore === undefined;
  });
  console.log('3. Store is undefined inside als.exit():', isolated);

  return 'Task completed';
});

console.log('4. Run result:', result);

// Edge-case: reading store outside als.run returns undefined
const fallbackStore = als.getStore();
console.log('5. Store outside als.run is undefined:', fallbackStore === undefined);
```

Jalankan file:

```bash
node als.mjs
```

Output:

```
1. Inside context store: TRACE-987
2. Orders retrieved for trace: TRACE-987
3. Store is undefined inside als.exit(): true
4. Run result: Task completed
5. Store outside als.run is undefined: true
```

Method `als.run()` mengikat objek store sepanjang seluruh rantai eksekusi asinkron di dalam callback. Jika `als.getStore()` dipanggil di luar cakupan `run()` atau di dalam blok `als.exit()`, nilai yang dikembalikan adalah `undefined`, mencegah kebocoran context ke operasi lain.

## Referensi API

| API | Fungsi |
|---|---|
| `setTimeout(callback, delay[, ...args])` | Menjadwalkan pemanggilan `callback` satu kali setelah `delay` milidetik. `callback` (function, wajib), `delay` (number, opsional, default `1`), `...args` (any, opsional). Returns `Timeout`. |
| `clearTimeout(timeout)` | Membatalkan timer `Timeout` yang dijadwalkan oleh `setTimeout()`. `timeout` (Timeout, wajib). Returns `void`. |
| `setInterval(callback, delay[, ...args])` | Menjadwalkan eksekusi berulang `callback` setiap interval `delay` milidetik. `callback` (function, wajib), `delay` (number, opsional, default `1`), `...args` (any, opsional). Returns `Timeout`. |
| `clearInterval(interval)` | Menghentikan eksekusi berulang timer interval. `interval` (Timeout, wajib). Returns `void`. |
| `timeout.unref()` / `timeout.ref()` | `unref()` melepas keharusan timer aktif mempertahankan event loop proses Node.js; `ref()` mengaktifkannya kembali. Returns `Timeout`. |
| `setImmediate(callback[, ...args])` | Menjadwalkan callback pada fase Check segera setelah fase I/O poll selesai. `callback` (function, wajib), `...args` (any, opsional). Returns `Immediate`. |
| `clearImmediate(immediate)` | Membatalkan antrean `Immediate` sebelum dieksekusi pada fase Check. `immediate` (Immediate, wajib). Returns `void`. |
| `process.nextTick(callback[, ...args])` | Menjadwalkan callback microtask prioritas tinggi yang dieksekusi sebelum beralih ke fase event loop berikutnya. `callback` (function, wajib), `...args` (any, opsional). Returns `void`. |
| `queueMicrotask(callback)` | Menjadwalkan microtask standar WHATWG ke dalam queue Promise. `callback` (function, wajib). Returns `void`. |
| `timersPromises.setTimeout([delay[, value[, options]]])` | Menunda eksekusi berbasis Promise. `delay` (number, opsional, default `1`), `value` (any, opsional), `options` (object `{ signal, ref }`, opsional). Returns `Promise<any>`. |
| `timersPromises.setImmediate([value[, options]])` | Menjadwalkan resolusi Promise pada fase Check. `value` (any, opsional), `options` (object `{ signal, ref }`, opsional). Returns `Promise<any>`. |
| `timersPromises.setInterval([delay[, value[, options]]])` | Mengembalikan async iterable iterator yang memancarkan `value` setiap `delay` milidetik. `delay` (number, opsional, default `1`), `value` (any, opsional), `options` (object `{ signal, ref }`, opsional). Returns `AsyncIterable<any>`. |
| `asyncLocalStorage.run(store, callback[, ...args])` | Mengikat data konteks `store` sepanjang siklus eksekusi `callback` asinkron. `store` (any, wajib), `callback` (function, wajib), `...args` (any, opsional). Returns kembalian `callback`. |
| `asyncLocalStorage.getStore()` | Mengambil nilai atau objek konteks store aktif dari eksekusi asinkron saat ini. Returns `any` (atau `undefined` jika di luar konteks). |
| `asyncLocalStorage.exit(callback[, ...args])` | Menjalankan `callback` sinkron di luar konteks store aktif (`getStore()` bernilai `undefined`). `callback` (function, wajib), `...args` (any, opsional). Returns kembalian `callback`. |

## Kasus di Aplikasi

Pada arsitektur microservices dan server HTTP backend, setiap request masuk wajib diberi pelacak unik (*correlation/trace ID*) dan dilindungi dengan batas waktu (SLA timeout) agar pemanggilan lambat tidak memblokir resource server.

**Masalah:** Mengirimkan objek request atau `traceId` secara eksplisit ke setiap service dan fungsi query database menimbulkan *prop drilling* yang merusak modularitas kode. Selain itu, ketiadaan batas waktu timeout pada pemanggilan lambat dapat mengakibatkan penumpukan koneksi dan server crash.

**Solusi:** Bungkus penanganan request menggunakan `AsyncLocalStorage.run()` untuk menyediakan akses log transparan di seluruh layer, dan gunakan `AbortSignal.timeout()` bersama `node:timers/promises` untuk membatalkan eksekusi jika melebihi ambang batas toleransi.

```js
import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';

const tracerStorage = new AsyncLocalStorage();

// Helper logger: read traceId from the active async context transparently
function logger(level, message) {
  const store = tracerStorage.getStore();
  const traceId = store?.traceId ?? 'SYSTEM';
  console.log(`[${traceId}] [${level}] ${message}`);
}

// Database query simulation guarded by an AbortSignal
async function simulateDatabaseQuery(durationMs, signal) {
  logger('INFO', 'Querying database...');
  await setTimeout(durationMs, null, { signal });
  return { status: 'success', rows: 5 };
}

// HTTP Server with per-request context isolation
const server = http.createServer(async (req, res) => {
  const traceId = req.headers['x-request-id'] || 'trace-default';
  const store = { traceId, startTime: Date.now() };

  await tracerStorage.run(store, async () => {
    logger('INFO', `Incoming request: ${req.url}`);

    try {
      // Normal: apply a 50ms timeout limit to mitigate slow queries
      const timeoutSignal = AbortSignal.timeout(50);
      const isSlow = req.url === '/slow';
      const delay = isSlow ? 100 : 20;

      const data = await simulateDatabaseQuery(delay, timeoutSignal);
      logger('INFO', 'Request completed successfully');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      // Edge-case: handle SLA timeout when query exceeds threshold
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        logger('WARN', 'Request exceeded SLA timeout limit');
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Timeout' }));
      } else {
        logger('ERROR', `Internal failure: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
  });
});

server.listen(0, async () => {
  const port = server.address().port;
  logger('INFO', `Server active on port ${port}`);

  // 1. Fast request completing within SLA limit
  await fetch(`http://localhost:${port}/fast`, {
    headers: { 'x-request-id': 'REQ-FAST-01' },
  });

  // 2. Slow request exceeding SLA limit and triggering timeout abort
  await fetch(`http://localhost:${port}/slow`, {
    headers: { 'x-request-id': 'REQ-SLOW-02' },
  });

  server.close(() => {
    logger('INFO', 'Server closed cleanly');
  });
});
```

## Pitfalls

- Menjalankan `process.nextTick` secara rekursif tak berujung. Ini menyebabkan *event loop starvation* karena antrean tick tidak pernah kosong, sehingga fase I/O poll dan timers macet total.
  ```js
  // ❌ Incorrect: recursive nextTick starves event loop I/O
  function recursiveTick() {
    process.nextTick(recursiveTick);
  }
  recursiveTick();

  // ✅ Correct: use setImmediate or await setTimeout to yield execution
  function safeRecursion() {
    setImmediate(() => {
      // Allows I/O and timers to execute between iterations
      safeRecursion();
    });
  }
  ```
- Lupa menangani exception `AbortError` saat membatalkan timer `node:timers/promises` dengan `AbortSignal`.
  ```js
  // ❌ Incorrect: unhandled AbortError crashes process with UnhandledPromiseRejection
  const controller = new AbortController();
  setTimeout(100, null, { signal: controller.signal });
  controller.abort();

  // ✅ Correct: wrap in try...catch and check err.name
  try {
    const controller = new AbortController();
    const promise = setTimeout(100, null, { signal: controller.signal });
    controller.abort();
    await promise;
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
  ```
- Mengabaikan pembersihan timer `setInterval` saat proses berjalan jangka panjang, mengakibatkan kebocoran memori atau proses gagal berhenti.
  ```js
  // ❌ Incorrect: interval keeps process alive indefinitely
  setInterval(() => {
    pingHealth();
  }, 1000);

  // ✅ Correct: retain timer reference to clear or unref when idle
  const healthTimer = setInterval(() => {
    pingHealth();
  }, 1000);
  healthTimer.unref(); // Allows process to terminate naturally
  ```
- Memutasi objek state bersama secara langsung di luar `AsyncLocalStorage.run()`, mengakibatkan data antar request konkuren saling tertimpa (*context bleeding*).
  ```js
  // ❌ Incorrect: shared mutable object mutated outside run
  const sharedStore = {};
  als.run(sharedStore, () => {
    sharedStore.userId = 'alice';
  });

  // ✅ Correct: instantiate dedicated immutable or isolated Map per execution
  await als.run(new Map([['userId', 'alice']]), async () => {
    const user = als.getStore().get('userId');
  });
  ```
- Mengasumsikan urutan `process.nextTick` selalu mendahului `queueMicrotask` di *top-level* berkas `.mjs` (ES Module). Karena modul ESM dievaluasi sebagai V8 Promise job, microtask Promise berjalan lebih dulu sebelum `nextTick` di tingkat file.
  ```js
  // ❌ Incorrect: expecting nextTick to run first at top-level .mjs
  // Top-level .mjs evaluation runs inside a V8 Promise job
  queueMicrotask(() => console.log('microtask'));
  process.nextTick(() => console.log('nextTick')); // Output: microtask, then nextTick

  // ✅ Correct: place scheduling inside an event loop callback for consistent order
  setImmediate(() => {
    queueMicrotask(() => console.log('microtask'));
    process.nextTick(() => console.log('nextTick')); // Output: nextTick, then microtask
  });
  ```

## Referensi

- [Node.js Docs: Timers](https://nodejs.org/api/timers.html) — dokumentasi resmi API timers callback dan promise.
- [Node.js Docs: Async Context Tracking](https://nodejs.org/api/async_context.html) — dokumentasi resmi AsyncLocalStorage dan manajemen konteks asinkron.
- [Node.js Docs: Process NextTick](https://nodejs.org/api/process.html#processnexttickcallback-args) — dokumentasi antrean microtask process.nextTick.
- [Node.js Docs: HTTP](https://nodejs.org/api/http.html) — modul server pendukung yang digunakan pada implementasi request tracer di Kasus di Aplikasi.

---

Berikutnya: [07 - HTTP](../07-http/README.md)
