# Events

> Mengatur komunikasi antar-komponen berbasis pola Publisher/Subscriber pakai EventEmitter, mulai dari pasang dan lepas listener, atur prioritas antrean, cegah memory leak, sampai konsumsi event asinkron berbasis Promise.

## Kenapa Perlu?

Aplikasi backend butuh pemisahan tanggung jawab (*decoupling*) yang jelas supaya fungsi utama tidak terbebani urusan sampingan seperti kirim email, simpan audit log, atau update analitik. Kalau semua logika itu ditumpuk di satu fungsi secara monolitik, kode jadi berantakan, susah di-test, dan rentan error saat ada layanan luar yang lambat atau down. Modul `node:events` menyediakan class `EventEmitter` sebagai fondasi komunikasi berbasis event di Node.js agar setiap komponen bisa bereaksi secara independen dan modular.

## Konsep Inti

- `EventEmitter` bekerja dengan pola *Publisher/Subscriber*: objek memancarkan event lewat `emit()`, lalu fungsi listener (`on`/`once`) yang terdaftar akan langsung merespons secara berurutan.
- Seluruh listener dipanggil secara sinkron sesuai urutan daftarnya; task CPU berat di dalam satu listener bakal memblokir listener berikutnya dan event loop.
- Event `'error'` punya sifat khusus: kalau dipancarkan tanpa ada listener `'error'` yang aktif, Node.js langsung melempar unhandled exception dan bikin proses aplikasi crash.
- Batas default listener adalah 10 per event; jika terlampaui, Node.js mencetak peringatan `MaxListenersExceededWarning` untuk mengingatkan potensi kebocoran memori (*memory leak*).
- Node.js menyediakan API modern berbasis Promise seperti `events.once()` dan `events.on()` yang bisa digabung dengan `AbortSignal` untuk pembatalan asinkron yang bersih.

## Langkah 1: Pasang Listener dan Emit Event Dasar

Kita memasang listener biasa dan sekali pakai, memancarkan event beserta datanya, mengecek status penerima, serta melepas listener yang sudah tidak dipakai.

Buat file `event-basic.mjs`.

```js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: register persistent listener with on()
function handleUserLogin(userId, role) {
  console.log(`User logged in: ${userId} (${role})`);
}
bus.on('user:login', handleUserLogin);

// Normal: register one-time listener with once()
bus.once('app:ready', (version) => {
  console.log(`System initialized with version: ${version}`);
});

// Normal: emit event with arguments payload
bus.emit('app:ready', '1.0.0');
bus.emit('app:ready', '1.0.1'); // Note: Does not trigger listener since once listener was removed

bus.emit('user:login', 'USR-001', 'ADMIN');

// Normal: remove specific listener reference with off()
bus.off('user:login', handleUserLogin);
bus.emit('user:login', 'USR-002', 'GUEST'); // Note: Does not trigger listener

// Edge-case: emit an event that has no registered listeners
const hasOrderListeners = bus.emit('order:created', { id: 'ORD-99' });
console.log('Delivered to order listeners:', hasOrderListeners);

// Edge-case: attempting to remove listener using new anonymous function reference
bus.on('ping', () => console.log('PONG-1'));
bus.off('ping', () => console.log('PONG-1')); // Note: Different function reference in memory
console.log('Active ping listeners:', bus.listenerCount('ping'));
```

Jalankan file:

```bash
node event-basic.mjs
```

Output:

```
System initialized with version: 1.0.0
User logged in: USR-001 (ADMIN)
Delivered to order listeners: false
Active ping listeners: 1
```

Method `bus.on()` memasang listener yang akan dipanggil setiap kali event dipancarkan, sedangkan `bus.once()` otomatis mencopot dirinya sendiri begitu selesai dipanggil pertama kali. Pemanggilan `bus.emit()` mengembalikan `true` jika ada listener yang menangkap event tersebut, atau `false` jika tidak ada yang mendengarkan. Melepas listener lewat `bus.off()` wajib memakai referensi fungsi yang sama; membuat fungsi anonim baru saat memanggil `off()` tidak akan berpengaruh apa pun dan membuat listener tetap aktif di memori.

## Langkah 2: Atur Prioritas Eksekusi Listener

Kita menaruh listener penting di urutan terdepan antrean eksekusi dan menguji listener sekali pakai di posisi awal.

Buat file `event-priority.mjs`.

```js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: register standard listener appended to the end of the queue
bus.on('request', (id) => {
  console.log(`[Order 2] Processing business logic for ${id}`);
});

// Normal: prepend high-priority audit listener to the front of the queue
bus.prependListener('request', (id) => {
  console.log(`[Order 1] Security audit check for ${id}`);
});

// Edge-case: prepend one-time listener to the very beginning
bus.prependOnceListener('request', (id) => {
  console.log(`[Priority First-Run] Bootstrap cache on initial request for ${id}`);
});

console.log('--- First Emit ---');
bus.emit('request', 'REQ-101');

console.log('--- Second Emit ---');
bus.emit('request', 'REQ-102');
```

Jalankan file:

```bash
node event-priority.mjs
```

Output:

```
--- First Emit ---
[Priority First-Run] Bootstrap cache on initial request for REQ-101
[Order 1] Security audit check for REQ-101
[Order 2] Processing business logic for REQ-101
--- Second Emit ---
[Order 1] Security audit check for REQ-102
[Order 2] Processing business logic for REQ-102
```

Secara default, listener yang didaftarkan lewat `on()` akan masuk ke urutan paling belakang antrean. Method `prependListener()` menyisipkan listener langsung ke urutan pertama agar dijalankan sebelum listener lainnya. Menggunakan `prependOnceListener()` memastikan fungsi inisialisasi dijalankan paling awal pada pemanggilan pertama, lalu otomatis dihapus pada pemanggilan berikutnya.

## Langkah 3: Batasi Jumlah Listener dan Bersihkan Memory Leak

Kita memeriksa batas maksimal listener, mengubah batasnya agar potensi memory leak terpantau, menghitung listener aktif, dan membersihkan listener yang sudah selesai.

Buat file `event-memory.mjs`.

```js
import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: inspect default listener threshold (default 10)
console.log('Default max listeners:', bus.getMaxListeners());

// Normal: adjust listener limit to 3 to track resource leaks
bus.setMaxListeners(3);
console.log('Custom max listeners:', bus.getMaxListeners());

// Normal: register listeners and inspect active count
const taskListenerA = () => {};
const taskListenerB = () => {};
bus.on('task', taskListenerA);
bus.on('task', taskListenerB);
console.log('Active task listeners:', bus.listenerCount('task'));

// Edge-case: remove all listeners for a specific event
bus.removeAllListeners('task');
console.log('Task listeners after specific removal:', bus.listenerCount('task'));

// Edge-case: clear all registered events completely across the instance
bus.on('metric:cpu', () => {});
bus.on('metric:ram', () => {});
console.log('CPU listeners before global flush:', bus.listenerCount('metric:cpu'));
console.log('RAM listeners before global flush:', bus.listenerCount('metric:ram'));

bus.removeAllListeners();
console.log('CPU listeners after global flush:', bus.listenerCount('metric:cpu'));
console.log('RAM listeners after global flush:', bus.listenerCount('metric:ram'));
```

Jalankan file:

```bash
node event-memory.mjs
```

Output:

```
Default max listeners: 10
Custom max listeners: 3
Active task listeners: 2
Task listeners after specific removal: 0
CPU listeners before global flush: 1
RAM listeners before global flush: 1
CPU listeners after global flush: 0
RAM listeners after global flush: 0
```

Batas default 10 listener dipasang Node.js untuk mendeteksi bug umum di mana fungsi callback terus menumpuk tanpa pernah dicopot (misalnya saat pasang listener di dalam request handler HTTP). Kita bisa mengecek limitnya dengan `getMaxListeners()` dan mengubahnya lewat `setMaxListeners()`. Method `listenerCount()` dipakai untuk memvalidasi jumlah listener aktif pada event tertentu, sedangkan `removeAllListeners()` membersihkan seluruh listener pada satu event atau semua event sekaligus.

## Langkah 4: Handle Event Error dan Pantau Telemetri Diagnostik

Kita menangani event `'error'` secara aman agar proses tidak crash, lalu memantau error menggunakan `errorMonitor` tanpa memutus alur penanganan aslinya.

Buat file `event-error.mjs`.

```js
import { EventEmitter, errorMonitor } from 'node:events';

const bus = new EventEmitter();

// Normal: use errorMonitor symbol to record telemetry without consuming the error
bus.on(errorMonitor, (err) => {
  console.log('[Audit Log] Monitored error occurrence:', err.message);
});

// Normal: gracefully handle 'error' event with dedicated listener
bus.on('error', (err) => {
  console.log('[Error Handler] Gracefully handled error:', err.message);
});

// Emitting safe handled error
bus.emit('error', new Error('Database connection timeout'));

// Edge-case: emitting 'error' on emitter without any 'error' listener registered
const unhandledBus = new EventEmitter();

// errorMonitor observes the error before the unhandled exception is thrown
unhandledBus.on(errorMonitor, (err) => {
  console.log('[Audit Log Unhandled] Sensed error before throw:', err.message);
});

try {
  // Without an active 'error' listener, emit('error') immediately throws
  unhandledBus.emit('error', new Error('Fatal socket failure'));
} catch (err) {
  console.log('[Caught Exception] Prevented crash from missing error listener:', err.message);
}
```

Jalankan file:

```bash
node event-error.mjs
```

Output:

```
[Audit Log] Monitored error occurrence: Database connection timeout
[Error Handler] Gracefully handled error: Database connection timeout
[Audit Log Unhandled] Sensed error before throw: Fatal socket failure
[Caught Exception] Prevented crash from missing error listener: Fatal socket failure
```

Event `'error'` diperlakukan khusus oleh runtime Node.js: jika dipancarkan tanpa ada listener `'error'`, proses Node.js akan langsung crash seketika karena unhandled exception. Menggunakan simbol `EventEmitter.errorMonitor` memungkinkan sistem audit atau APM merekam error yang terjadi tanpa mengonsumsi error tersebut, sehingga listener `'error'` utama tetap bisa memproses penanganan masalah secara semestinya.

## Langkah 5: Tunggu dan Ambil Event Asinkron Menggunakan Promise

Kita menunggu pemancaran satu event menggunakan Promise, mengonsumsi deretan event terus-menerus lewat async iterator, dan membatalkannya secara aman memakai `AbortSignal`.

Buat file `event-async.mjs`.

```js
import { EventEmitter, once, on } from 'node:events';

const bus = new EventEmitter();

// Normal: wait for a single event using Promise with once()
setTimeout(() => {
  bus.emit('ready', { status: 'ONLINE', port: 3000 });
}, 10);

const [readyPayload] = await once(bus, 'ready');
console.log(`System status: ${readyPayload.status} on port ${readyPayload.port}`);

// Normal & Edge-case: consume continuous event stream via async iterator with cancellation signal
const controller = new AbortController();
const { signal } = controller;

let counter = 0;
const intervalId = setInterval(() => {
  counter += 1;
  bus.emit('tick', counter);

  if (counter === 2) {
    // Edge-case: gracefully terminate event consumption using AbortController
    controller.abort();
    clearInterval(intervalId);
  }
}, 10);

try {
  for await (const [count] of on(bus, 'tick', { signal })) {
    console.log(`Received tick count: ${count}`);
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Async event stream closed gracefully via AbortSignal');
  } else {
    throw err;
  }
}
```

Jalankan file:

```bash
node event-async.mjs
```

Output:

```
System status: ONLINE on port 3000
Received tick count: 1
Received tick count: 2
Async event stream closed gracefully via AbortSignal
```

Fungsi `events.once()` mengembalikan Promise yang resolve dengan array argumen saat event terpicu, atau reject jika terjadi error atau pembatalan sinyal. Fungsi `events.on()` menghasilkan AsyncIterator yang bisa kita loop dengan `for await...of` untuk memproses aliran data event satu demi satu. Memberikan opsi `{ signal }` dari `AbortController` memastikan perulangan asinkron bisa dihentikan kapan saja tanpa meninggalkan listener menggantung di memori.

## Referensi API

Berikut adalah tabel ringkasan method dan fungsi inti dari modul `node:events`:

| API | Fungsi |
|---|---|
| `emitter.on(eventName, listener)` | Mendaftarkan listener di akhir antrean. `eventName` (string \| symbol, wajib), `listener` (Function, wajib). Returns `EventEmitter`. |
| `emitter.emit(eventName, ...args)` | Memanggil seluruh listener terdaftar secara sinkron. `eventName` (string \| symbol, wajib), `...args` (any, opsional). Returns `boolean`. |
| `emitter.once(eventName, listener)` | Mendaftarkan listener satu kali pakai yang otomatis dicopot setelah dieksekusi. `eventName` (string \| symbol, wajib), `listener` (Function, wajib). Returns `EventEmitter`. |
| `emitter.off(eventName, listener)` | Menghapus listener tertentu dari daftar antrean. `eventName` (string \| symbol, wajib), `listener` (Function, wajib). Returns `EventEmitter`. |
| `emitter.prependListener(eventName, listener)` | Mendaftarkan listener di posisi terdepan antrean eksekusi. `eventName` (string \| symbol, wajib), `listener` (Function, wajib). Returns `EventEmitter`. |
| `emitter.prependOnceListener(eventName, listener)` | Mendaftarkan listener satu kali pakai di urutan terdepan antrean. `eventName` (string \| symbol, wajib), `listener` (Function, wajib). Returns `EventEmitter`. |
| `emitter.setMaxListeners(n)` | Mengubah ambang batas maksimal listener sebelum peringatan memory leak muncul. `n` (number, wajib, `>= 0`). Returns `EventEmitter`. |
| `emitter.getMaxListeners()` | Membaca batas maksimal listener aktif yang dikonfigurasikan pada instance. Returns `number`. |
| `emitter.listenerCount(eventName)` | Menghitung jumlah listener aktif yang terdaftar untuk suatu nama event. `eventName` (string \| symbol, wajib). Returns `number`. |
| `emitter.removeAllListeners(eventName?)` | Menghapus seluruh listener dari satu event tertentu atau seluruh event sekaligus jika tanpa parameter. `eventName` (string \| symbol, opsional). Returns `EventEmitter`. |
| `EventEmitter.errorMonitor` | Simbol khusus untuk mengamati event `'error'` tanpa mengonsumsi error tersebut dari listener `'error'`. |
| `events.once(emitter, eventName, options?)` | Menghasilkan Promise yang resolve saat event dipancarkan atau reject saat terjadi error/abort. `emitter` (EventEmitter \| EventTarget, wajib), `eventName` (string \| symbol, wajib), `options` (object, opsional: `{ signal }`). Returns `Promise<any[]>`. |
| `events.on(emitter, eventName, options?)` | Mengembalikan AsyncIterator untuk mengonsumsi event berulang dalam perulangan `for await...of`. `emitter` (EventEmitter \| EventTarget, wajib), `eventName` (string \| symbol, wajib), `options` (object, opsional: `{ signal, close, highWaterMark, lowWaterMark }`). Returns `AsyncIterator<any[]>`. |

## Kasus di Aplikasi

Di backend, alur transaksi pembayaran atau checkout pesanan harus memicu beberapa aksi terpisah seperti pencatatan audit log keuangan, pengiriman email konfirmasi, dan reservasi stok barang tanpa membuat controller pembayaran menjadi kaku atau rumit.

**Masalah:** Menyatukan logika email, audit, dan inventory langsung di dalam satu fungsi checkout bikin kode saling terkait erat (*tight coupling*). Kalau integrasi email bermasalah atau lambat, transaksi pembayaran pengguna bisa ikut gagal atau terhenti.

**Solusi:** Gunakan class turunan `EventEmitter` sebagai event bus domain internal. Service checkout cukup memancarkan event `order:created`, lalu modul audit, email, inventory, dan logger APM merespons secara independen dengan prioritas dan penanganan error masing-masing.

```js
import { EventEmitter, errorMonitor } from 'node:events';

class OrderService extends EventEmitter {
  constructor() {
    super();
    // Configure safe listener quota for domain service instance
    this.setMaxListeners(10);
  }

  processCheckout(orderId, customerEmail, amount) {
    if (!orderId || amount <= 0) {
      this.emit('error', new Error(`Invalid checkout payload for order ${orderId}`));
      return false;
    }

    console.log(`[OrderService] Checkout initiated for ${orderId}`);
    this.emit('order:created', { orderId, customerEmail, amount, timestamp: Date.now() });
    return true;
  }
}

const orderService = new OrderService();

// 1. Audit logger: Register at the very front with high priority
orderService.prependListener('order:created', (order) => {
  console.log(`[Audit Trail] High-priority ledger recorded: ${order.orderId} ($${order.amount})`);
});

// 2. Email notification handler: Decoupled notification delivery
orderService.on('order:created', (order) => {
  console.log(`[Notification Service] Confirmation email dispatched to ${order.customerEmail}`);
});

// 3. Inventory allocation: Stock reservation handler
orderService.on('order:created', (order) => {
  console.log(`[Inventory Service] Stock reserved for order ${order.orderId}`);
});

// 4. Centralized telemetry monitoring: Observe errors without consuming them
orderService.on(errorMonitor, (err) => {
  console.log(`[Telemetry Monitor] Alert logged to APM: ${err.message}`);
});

// 5. Error handling listener: Guard process stability against uncaught crash
orderService.on('error', (err) => {
  console.log(`[Error Boundary] Safe recovery for failure: ${err.message}`);
});

// Scenario 1: Successful checkout
console.log('--- Successful Checkout ---');
orderService.processCheckout('ORD-8821', 'customer@example.com', 150);

// Scenario 2: Invalid checkout payload triggering error event
console.log('--- Failed Checkout ---');
orderService.processCheckout('ORD-ERR', 'invalid@example.com', -20);
```

## Pitfalls

- Memancarkan event `'error'` tanpa mendaftarkan listener `'error'` sebelumnya. Node.js memperlakukan hal ini sebagai uncaught exception fatal yang langsung mematikan proses aplikasi di produksi.
  ```js
  // ❌ Incorrect: process crashes because no error listener handles the emitted error
  const bus = new EventEmitter();
  bus.emit('error', new Error('Database connection failed'));

  // ✅ Correct: register dedicated error listener before emitting error
  const bus = new EventEmitter();
  bus.on('error', (err) => {
    console.error('Safely handled error event:', err.message);
  });
  bus.emit('error', new Error('Database connection failed'));
  ```
- Menghapus listener menggunakan referensi fungsi anonim baru. JavaScript mencocokkan fungsi berdasarkan alamat memori objeknya; arrow function baru tidak akan pernah cocok dengan yang sudah terdaftar, sehingga listener asli tetap aktif dan membocorkan memori.
  ```js
  // ❌ Incorrect: anonymous arrow function creates a new reference; removal silently fails
  bus.on('data', () => console.log('Data received'));
  bus.off('data', () => console.log('Data received'));

  // ✅ Correct: keep a named variable reference to ensure identity equality
  const onData = () => console.log('Data received');
  bus.on('data', onData);
  bus.off('data', onData);
  ```
- Menumpuk listener di dalam request handler HTTP atau perulangan tanpa pernah mencopotnya. Setiap ada request masuk, callback baru terus bertambah ke instance `EventEmitter` yang sama sampai batas kuota terlampaui dan memicu memory leak pada heap.
  ```js
  // ❌ Incorrect: accumulates duplicate listeners on every incoming request
  server.on('request', (req, res) => {
    globalBus.on('notification', () => res.write('Update'));
  });

  // ✅ Correct: use once() or clean up listener when connection closes
  server.on('request', (req, res) => {
    const onNotify = () => res.write('Update');
    globalBus.on('notification', onNotify);
    res.on('close', () => globalBus.off('notification', onNotify));
  });
  ```
- Mengira eksekusi listener `EventEmitter` otomatis berjalan di latar (*non-blocking*). Nyatanya, seluruh listener dijalankan secara sinkron satu per satu; jika ada listener yang menjalankan komputasi CPU berat atau loop besar, event loop akan langsung macet.
  ```js
  // ❌ Incorrect: synchronous CPU-heavy work blocks subsequent listeners and event loop
  bus.on('event', () => {
    let sum = 0;
    for (let i = 0; i < 1e9; i++) sum += i;
  });

  // ✅ Correct: delegate intensive tasks asynchronously or offload to worker threads
  bus.on('event', () => {
    setImmediate(() => {
      // Deferred execution allows event loop to process other I/O
    });
  });
  ```
- Menunggu event dengan `events.once()` tanpa menyertakan `AbortSignal`. Jika event yang dinanti tidak kunjung dipancarkan karena ada kegagalan jaringan atau alur yang terputus, Promise tersebut akan menggantung di memori selamanya (*promise leak*).
  ```js
  // ❌ Incorrect: hangs indefinitely if 'socket:ready' is never emitted
  await once(socket, 'socket:ready');

  // ✅ Correct: guard with AbortController timeout signal
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    await once(socket, 'socket:ready', { signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
  ```

## Referensi

- [Node.js Docs: Events](https://nodejs.org/api/events.html) — dokumentasi resmi modul `node:events` dan class `EventEmitter`
- [Node.js Docs: Errors](https://nodejs.org/api/errors.html) — panduan penanganan error dan konvensi event `'error'` di Node.js
- [Node.js Docs: AbortController](https://nodejs.org/api/globals.html#class-abortcontroller) — standar pembatalan operasi asinkron yang digunakan bersama opsi `signal` pada `events.once()` dan `events.on()`

---

Berikutnya: [05 - Buffer & Stream](../05-buffer-stream/README.md)
