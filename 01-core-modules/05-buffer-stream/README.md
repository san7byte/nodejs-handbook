# Buffer & Stream

> Mengelola data biner mentah secara efisien di luar heap V8 menggunakan `Buffer` serta mengalirkan dan mentransformasi data berukuran besar secara asinkron tanpa membebani RAM menggunakan `Stream`.

## Kenapa Perlu?

Aplikasi backend sering kali harus menangani data biner mentah seperti gambar, berkas unggahan, paket jaringan TCP, dan file log berukuran gigabyte. Jika berkas berukuran besar dibaca sekaligus ke dalam memori menggunakan string atau buffer utuh, server akan mengalami lonjakan RAM ekstrem hingga memicu crash *heap out of memory* (OOM). Kombinasi `Buffer` untuk representasi biner berkecepatan tinggi dan `Stream` untuk pemrosesan data per potongan (*chunks*) secara bertahap memungkinkan aplikasi memproses data dalam volume tak terbatas dengan konsumsi memori yang tetap kecil dan konstan.

## Konsep Inti

- `Buffer` mengalokasikan memori biner mentah langsung di layer C++ di luar V8 JavaScript heap, sehingga sangat cepat untuk operasi I/O jaringan dan sistem berkas.
- `Buffer.from()` dan `Buffer.alloc()` adalah metode standar yang aman untuk alokasi memori biner, menggantikan constructor usang `new Buffer()` dan alokasi `Buffer.allocUnsafe()` yang berisiko mengekspos byte memori lama yang belum dibersihkan.
- Ada 4 jenis Stream utama di Node.js: `Readable` (sumber data), `Writable` (tujuan data), `Duplex` (baca dan tulis dua arah), dan `Transform` (memodifikasi chunk saat data mengalir).
- *Backpressure* terjadi ketika producer (`Readable`) mengirim data lebih cepat daripada kemampuan consumer (`Writable`) memprosesnya; `stream.pipeline` atau listener event `'drain'` mencegah penumpukan data di RAM.
- Submodul modern `node:stream/promises` (`pipeline`) dan `node:stream/consumers` (`text`, `json`, `buffer`) menyederhanakan orkestrasi stream berbasis Promise dan `async/await` yang aman dari kebocoran stream (*leak*) dan unhandled error.

## Langkah 1: Alokasi Memori, Penentuan Panjang Byte, dan Encoding Karakter Buffer

Kita mengalokasikan buffer memori bersih, memeriksa perbedaan panjang karakter string versus byte biner sebenarnya, membuat slice zero-copy, dan mengonversi format encoding biner.

Buat file `buffer-basic.mjs`.

```js
import { Buffer } from 'node:buffer';

// Normal: create buffer from UTF-8 string and compare character count vs actual byte length
const greeting = 'Halo Dunia ☕';
const bufGreeting = Buffer.from(greeting, 'utf8');
console.log('String length:', greeting.length);
console.log('Byte length (Buffer.byteLength):', Buffer.byteLength(greeting, 'utf8'));
console.log('Buffer byte length (buf.length):', bufGreeting.length);

// Normal: allocate clean zero-filled buffer with custom initial fill character
const fixedBuf = Buffer.alloc(6, 'X', 'utf8');
console.log('Allocated buffer text:', fixedBuf.toString('utf8'));

// Normal: create zero-copy memory slice using subarray
const sub = bufGreeting.subarray(0, 4); // Slices 'Halo'
console.log('Subarray text:', sub.toString('utf8'));

// Edge-case: modifying subarray mutates underlying shared memory of original buffer
sub[0] = 74; // ASCII for 'J'
console.log('Mutated original buffer text:', bufGreeting.toString('utf8'));

// Edge-case: validate data type using Buffer.isBuffer
console.log('Is valid Buffer (bufGreeting):', Buffer.isBuffer(bufGreeting));
console.log('Is plain Uint8Array a Buffer:', Buffer.isBuffer(new Uint8Array(4)));
console.log('Is string a Buffer:', Buffer.isBuffer('not a buffer'));

// Normal: binary encoding to Base64 and round-trip restoration
const base64Encoded = bufGreeting.toString('base64');
console.log('Base64 representation:', base64Encoded);
console.log('Restored from Base64:', Buffer.from(base64Encoded, 'base64').toString('utf8'));
```

Jalankan file:

```bash
node buffer-basic.mjs
```

Output:

```
String length: 12
Byte length (Buffer.byteLength): 14
Buffer byte length (buf.length): 14
Allocated buffer text: XXXXXX
Subarray text: Halo
Mutated original buffer text: Jalo Dunia ☕
Is valid Buffer (bufGreeting): true
Is plain Uint8Array a Buffer: false
Is string a Buffer: false
Base64 representation: SmFsbyBEdW5pYSDimJU=
Restored from Base64: Jalo Dunia ☕
```

Method `Buffer.byteLength()` menghitung jumlah byte biner aktual sesuai encoding, di mana karakter khusus seperti emoji `☕` membutuhkan 3 byte sehingga totalnya 14 byte meski panjang string hanya 12 karakter. Method `subarray()` membuat representasi view di atas blok memori yang sama (*zero-copy*), sehingga mengubah indeks byte pada subarray akan langsung memutasi buffer aslinya. Fungsi `Buffer.isBuffer()` memastikan integritas tipe data sebelum memproses masukan biner.

## Langkah 2: Penggabungan, Penyalinan Memori, dan Pencarian Byte Buffer

Kita menggabungkan beberapa buffer menjadi satu blok kontigu, menyalin data biner antar buffer, menguji kesetaraan isi memori, dan mencari posisi token biner.

Buat file `buffer-manipulation.mjs`.

```js
import { Buffer } from 'node:buffer';

// Normal: concatenate multiple buffers into a single contiguous buffer with Buffer.concat
const part1 = Buffer.from('Node.js ');
const part2 = Buffer.from('Streams ');
const part3 = Buffer.from('Rock!');
const combined = Buffer.concat([part1, part2, part3]);
console.log('Combined text:', combined.toString('utf8'));
console.log('Combined length:', combined.length);

// Normal: explicitly copy memory bytes into a pre-allocated target buffer
const target = Buffer.alloc(4);
part1.copy(target, 0, 0, 4); // Copy first 4 bytes ('Node') into target
console.log('Target buffer text:', target.toString('utf8'));

// Normal: check binary content equality using buffer.equals
const clonePart1 = Buffer.from('Node.js ');
console.log('part1 equals clonePart1:', part1.equals(clonePart1));
console.log('part1 equals part2:', part1.equals(part2));

// Normal: locate byte index of substring or buffer token using indexOf
const indexStream = combined.indexOf('Streams');
console.log("Index of 'Streams':", indexStream);

// Edge-case: indexOf returns -1 when target token is absent
console.log("Index of 'Python':", combined.indexOf('Python'));

// Edge-case: Buffer.concat with empty array returns 0-byte buffer
const emptyConcat = Buffer.concat([]);
console.log('Empty concat length:', emptyConcat.length);

// Edge-case: Buffer.concat with totalLength safely truncates data to specified limit
const truncatedConcat = Buffer.concat([part1, part2], 4);
console.log('Truncated concat text:', truncatedConcat.toString('utf8'));
```

Jalankan file:

```bash
node buffer-manipulation.mjs
```

Output:

```
Combined text: Node.js Streams Rock!
Combined length: 21
Target buffer text: Node
part1 equals clonePart1: true
part1 equals part2: false
Index of 'Streams': 8
Index of 'Python': -1
Empty concat length: 0
Truncated concat text: Node
```

Fungsi `Buffer.concat()` mengalokasikan buffer baru yang menampung gabungan seluruh elemen array; jika argumen `totalLength` diberikan, Node.js memotong buffer secara presisi sesuai kapasitas tersebut. Berbeda dengan `subarray()` yang berbagi referensi memori, `buffer.copy()` melakukan duplikasi byte fisik secara mandiri ke target terpisah. Method `buffer.equals()` membandingkan byte demi byte secara langsung tanpa perlu melakukan deserialisasi string yang lambat.

## Langkah 3: Aliran Data Readable, Writable, dan Mekanisme Backpressure

Kita mengalirkan data bertahap dari generator asinkron via Readable stream, mengamati penanganan antrean buffer Writable saat terjadi backpressure, dan menangani event `'drain'`.

Buat file `stream-backpressure.mjs`.

```js
import { Readable, Writable } from 'node:stream';

// Normal: create Readable stream from async generator using Readable.from
async function* generateData() {
  yield 'chunk-A\n';
  yield 'chunk-B\n';
}

const readable = Readable.from(generateData());
console.log('--- Reading from Readable Stream ---');
for await (const chunk of readable) {
  process.stdout.write('Read: ' + chunk);
}

// Normal: custom Writable with small highWaterMark to observe backpressure management
console.log('--- Writing with Backpressure Management ---');
const received = [];
const writer = new Writable({
  highWaterMark: 16, // Internal buffer threshold set to 16 bytes
  write(chunk, encoding, callback) {
    received.push(chunk.toString());
    // Simulate slight asynchronous processing delay
    setTimeout(callback, 20);
  },
});

function writeSafely(data) {
  return new Promise((resolve) => {
    const canContinue = writer.write(data);
    if (!canContinue) {
      console.log('Backpressure triggered: buffer full, waiting for drain event...');
      writer.once('drain', () => {
        console.log('Drain event received: buffer cleared, resuming writes');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

await writeSafely('A'.repeat(20)); // Exceeds 16 bytes highWaterMark
await writeSafely('B'.repeat(10));

// Normal: cleanly close writable stream using end()
await new Promise((resolve) => writer.end(resolve));
console.log('Total written chunks received:', received.length);

// Edge-case: writing to stream after end() invokes callback with ERR_STREAM_WRITE_AFTER_END
await new Promise((resolve) => {
  writer.write('C', (err) => {
    console.log('Write after end error caught:', err?.code);
    resolve();
  });
});
```

Jalankan file:

```bash
node stream-backpressure.mjs
```

Output:

```
--- Reading from Readable Stream ---
Read: chunk-A
Read: chunk-B
--- Writing with Backpressure Management ---
Backpressure triggered: buffer full, waiting for drain event...
Drain event received: buffer cleared, resuming writes
Total written chunks received: 2
Write after end error caught: ERR_STREAM_WRITE_AFTER_END
```

Fungsi `Readable.from()` membungkus iterable atau generator asinkron menjadi stream yang siap dikonsumsi memakai perulangan `for await...of`. Pemanggilan `writer.write()` mengembalikan `false` ketika kapasitas `highWaterMark` terlampaui (*backpressure*), sehingga producer wajib menahan pengiriman sampai event `'drain'` dipancarkan agar RAM tidak meluap. Memanggil `write()` setelah `writer.end()` ditutup akan memicu error `ERR_STREAM_WRITE_AFTER_END`.

## Langkah 4: Transformasi Data On-The-Fly Menggunakan Transform Stream

Kita membuat stream pemroses perantara untuk memodifikasi potongan data secara langsung saat mengalir, memanfaatkan hook `flush()`, dan meneruskan error secara aman.

Buat file `stream-transform.mjs`.

```js
import { Transform } from 'node:stream';

// Normal: create Transform stream to mutate incoming text chunks to uppercase
const upperTransform = new Transform({
  transform(chunk, encoding, callback) {
    const upperText = chunk.toString('utf8').toUpperCase();
    this.push(upperText);
    callback();
  },
  // Normal: flush is called after all input chunks are processed before stream ends
  flush(callback) {
    this.push('\n[STREAM_COMPLETED]\n');
    callback();
  },
});

upperTransform.on('data', (chunk) => {
  process.stdout.write(chunk.toString());
});

upperTransform.write('alpha\n');
upperTransform.write('beta');
upperTransform.end();

// Edge-case: Transform stream validating chunk contents and forwarding error safely
const validatorTransform = new Transform({
  transform(chunk, encoding, callback) {
    const text = chunk.toString('utf8');
    if (text.includes('INVALID')) {
      return callback(new Error('Payload validation failed: INVALID detected'));
    }
    callback(null, 'OK: ' + text);
  },
});

validatorTransform.on('data', (chunk) => {
  process.stdout.write(chunk.toString());
});

validatorTransform.on('error', (err) => {
  console.log('Validator error caught:', err.message);
});

validatorTransform.write('first chunk\n');
validatorTransform.write('INVALID chunk\n');
```

Jalankan file:

```bash
node stream-transform.mjs
```

Output:

```
ALPHA
BETA
[STREAM_COMPLETED]
OK: first chunk
Validator error caught: Payload validation failed: INVALID detected
```

Class `Transform` adalah jenis stream Duplex khusus di mana output dihitung langsung dari input melalui method `transform()`. Method `flush()` bertindak sebagai finalizer yang otomatis dipanggil tepat sebelum stream ditutup untuk mengeluarkan sisa data buffer terakhir. Mengirim objek `Error` ke parameter pertama `callback(err)` meneruskan error secara asinkron ke listener event `'error'` tanpa menghentikan thread JavaScript.

## Langkah 5: Mengalirkan Data Aman dengan Pipeline dan AbortSignal

Kita merangkai alur stream secara aman menggunakan `pipeline` dari `node:stream/promises` serta membatalkan proses yang menggantung menggunakan `AbortSignal`.

Buat file `stream-pipeline.mjs`.

```js
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Normal: connect Readable, Transform, and Writable streams safely with pipeline
const source = Readable.from(['item-1\n', 'item-2\n', 'item-3\n']);

const prefixTransform = new Transform({
  transform(chunk, enc, cb) {
    cb(null, `[PREFIX] ${chunk}`);
  },
});

const output = [];
const destination = new Writable({
  write(chunk, enc, cb) {
    output.push(chunk.toString());
    cb();
  },
});

console.log('--- Normal Pipeline Execution ---');
await pipeline(source, prefixTransform, destination);
console.log('Pipeline finished successfully. Collected output:');
process.stdout.write(output.join(''));

// Edge-case: aborting an active pipeline mid-execution via AbortSignal timeout
console.log('--- Aborted Pipeline Execution ---');
async function* infiniteSource() {
  let count = 1;
  while (true) {
    yield `data-${count++}\n`;
    await new Promise((r) => setTimeout(r, 100));
  }
}

const abortingDestination = new Writable({
  write(chunk, enc, cb) {
    process.stdout.write('Received: ' + chunk);
    cb();
  },
});

try {
  // Abort pipeline automatically after 150ms timeout
  await pipeline(
    infiniteSource,
    abortingDestination,
    { signal: AbortSignal.timeout(150) }
  );
} catch (err) {
  console.log('Pipeline aborted as expected with error name:', err.name);
}
```

Jalankan file:

```bash
node stream-pipeline.mjs
```

Output:

```
--- Normal Pipeline Execution ---
Pipeline finished successfully. Collected output:
[PREFIX] item-1
[PREFIX] item-2
[PREFIX] item-3
--- Aborted Pipeline Execution ---
Received: data-1
Received: data-2
Pipeline aborted as expected with error name: AbortError
```

Fungsi `pipeline()` dari `node:stream/promises` mengembalikan Promise dan otomatis menangani penghancuran (*destroy*) seluruh stream yang terhubung jika salah satu stream gagal atau selesai. Menggunakan opsi `{ signal: AbortSignal.timeout(...) }` memberikan perlindungan batas waktu (SLA) pada operasi I/O jaringan atau pemrosesan batch; jika waktu habis, seluruh stream dihentikan dan melempar `AbortError`.

## Langkah 6: Mengonsumsi Stream Secara Modern Menggunakan stream/consumers

Kita mengonsumsi seluruh isi Readable stream secara langsung menjadi teks string, objek JSON terurai, atau Buffer utuh menggunakan utilitas modern `node:stream/consumers`.

Buat file `stream-consumers.mjs`.

```js
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { text, json, buffer } from 'node:stream/consumers';

// Normal: consume readable stream directly into a string with text()
const textStream = Readable.from(['Hello, ', 'world ', 'from consumers!']);
const textResult = await text(textStream);
console.log('Consumed text:', textResult);

// Normal: consume and parse readable stream into a JSON object with json()
const payload = { service: 'auth-api', active: true, port: 8080 };
const jsonStream = Readable.from([JSON.stringify(payload)]);
const jsonResult = await json(jsonStream);
console.log('Consumed JSON service name:', jsonResult.service);
console.log('Consumed JSON port:', jsonResult.port);

// Normal: consume readable stream into a single Buffer instance with buffer()
const binaryStream = Readable.from([Buffer.from([0x01, 0x02]), Buffer.from([0x03, 0x04])]);
const bufferResult = await buffer(binaryStream);
console.log('Consumed Buffer length:', bufferResult.length);
console.log('Consumed Buffer hex:', bufferResult.toString('hex'));

// Edge-case: handling malformed JSON stream with json()
const malformedStream = Readable.from(['{ "broken": true, ']);
try {
  await json(malformedStream);
} catch (err) {
  console.log('Malformed JSON error caught:', err.name);
}

// Edge-case: consuming an empty stream with text() returns empty string
const emptyStream = Readable.from([]);
const emptyResult = await text(emptyStream);
console.log('Empty stream text length:', emptyResult.length);
```

Jalankan file:

```bash
node stream-consumers.mjs
```

Output:

```
Consumed text: Hello, world from consumers!
Consumed JSON service name: auth-api
Consumed JSON port: 8080
Consumed Buffer length: 4
Consumed Buffer hex: 01020304
Malformed JSON error caught: SyntaxError
Empty stream text length: 0
```

Modul `node:stream/consumers` menyederhanakan kode pembacaan stream tanpa perlu mendaftarkan listener event manual (`data`, `end`, `error`) atau loop asinkron secara berulang. Utilitas `json()` otomatis mengalirkan chunk biner, mendecode teks UTF-8, dan memanggil `JSON.parse()`, melempar `SyntaxError` jika payload rusak. Utilitas `text()` dan `buffer()` mengembalikan string kosong atau Buffer 0-byte secara aman saat menghadapi stream kosong.

## Referensi API

Berikut adalah tabel ringkasan method dan fungsi inti dari modul `node:buffer` dan `node:stream`:

| API | Fungsi |
|---|---|
| `Buffer.alloc(size, fill?, encoding?)` | Mengalokasikan instance Buffer baru dengan inisialisasi byte bersih. `size` (number, wajib), `fill` (string \| Buffer \| Uint8Array \| integer, opsional, default `0`), `encoding` (string, opsional, default `'utf8'`). Returns `Buffer`. |
| `Buffer.from(data, encoding?)` | Membuat instance Buffer baru dari string, array integer, ArrayBuffer, atau Buffer lain. `data` (string \| Array \| ArrayBuffer \| Buffer, wajib), `encoding` (string, opsional, default `'utf8'`). Returns `Buffer`. |
| `Buffer.byteLength(string, encoding?)` | Menghitung jumlah byte aktual dari string atau buffer sesuai encoding. `string` (string \| Buffer \| TypedArray, wajib), `encoding` (string, opsional, default `'utf8'`). Returns `number`. |
| `Buffer.concat(list, totalLength?)` | Menggabungkan array instance Buffer menjadi satu Buffer kontigu. `list` (Buffer[] \| Uint8Array[], wajib), `totalLength` (integer, opsional). Returns `Buffer`. |
| `Buffer.isBuffer(obj)` | Memeriksa apakah objek merupakan instance valid dari class Buffer. `obj` (any, wajib). Returns `boolean`. |
| `buffer.toString(encoding?, start?, end?)` | Mengonversi data biner buffer menjadi string sesuai rentang indeks byte. `encoding` (string, opsional, default `'utf8'`), `start` (number, opsional, default `0`), `end` (number, opsional, default `buffer.length`). Returns `string`. |
| `buffer.subarray(start?, end?)` | Mengembalikan view potongan buffer tanpa menyalin alokasi memori (zero-copy). `start` (number, opsional, default `0`), `end` (number, opsional, default `buffer.length`). Returns `Buffer`. |
| `buffer.copy(target, targetStart?, sourceStart?, sourceEnd?)` | Menyalin potongan byte dari buffer sumber ke buffer target. `target` (Buffer \| Uint8Array, wajib), `targetStart` (number, opsional, default `0`), `sourceStart` (number, opsional, default `0`), `sourceEnd` (number, opsional, default `buffer.length`). Returns `number`. |
| `buffer.indexOf(value, byteOffset?, encoding?)` | Mencari posisi indeks pertama dari byte atau string tertentu di dalam buffer. `value` (string \| Buffer \| Uint8Array \| number, wajib), `byteOffset` (number, opsional, default `0`), `encoding` (string, opsional, default `'utf8'`). Returns `number`. |
| `buffer.equals(otherBuffer)` | Membandingkan apakah dua buffer memiliki isi byte yang sama persis. `otherBuffer` (Buffer \| Uint8Array, wajib). Returns `boolean`. |
| `Readable.from(iterable, options?)` | Membuat Readable stream dari objek iterable atau async generator. `iterable` (Iterable \| AsyncIterable, wajib), `options` (object, opsional). Returns `Readable`. |
| `writable.write(chunk, encoding?, callback?)` | Menulis chunk data ke dalam writable stream dan mengembalikan boolean indikator backpressure. `chunk` (string \| Buffer \| any, wajib), `encoding` (string, opsional), `callback` (Function, opsional). Returns `boolean`. |
| `writable.end(chunk?, encoding?, callback?)` | Menandai bahwa tidak ada lagi data yang akan ditulis ke stream dan menutupnya. `chunk` (string \| Buffer \| any, opsional), `encoding` (string, opsional), `callback` (Function, opsional). Returns `this`. |
| `new Transform(options)` | Membuat instance Transform stream untuk memodifikasi chunk data saat mengalir. `options` (object, wajib: memuat handler `transform(chunk, encoding, callback)` dan opsional `flush(callback)`). Returns `Transform`. |
| `pipeline(...streams, options?)` | Menghubungkan serangkaian stream dengan auto-cleanup dan penerusan error berbasis Promise. `...streams` (Stream[] \| Iterable[] \| AsyncIterable[], wajib), `options` (object, opsional: `{ signal, end }`). Returns `Promise<void>`. |
| `text(stream)` | Mengonsumsi seluruh chunk dari Readable stream dan mengembalikannya sebagai string UTF-8. `stream` (Readable \| AsyncIterable, wajib). Returns `Promise<string>`. |
| `json(stream)` | Mengonsumsi dan mem-parsing aliran data dari Readable stream sebagai objek JavaScript via JSON.parse. `stream` (Readable \| AsyncIterable, wajib). Returns `Promise<any>`. |
| `buffer(stream)` | Mengonsumsi seluruh chunk biner dari Readable stream ke dalam satu instance Buffer utuh. `stream` (Readable \| AsyncIterable, wajib). Returns `Promise<Buffer>`. |

## Kasus di Aplikasi

Di backend layanan pembayaran dan perbankan, sistem menerima jutaan baris log transaksi per hari dalam format NDJSON (Newline Delimited JSON). Log ini mengandung data sensitif seperti token otorisasi (`token`) dan nomor kartu kredit (`cardNumber`) yang dilarang keras dicatat secara mentah oleh regulasi keamanan data (seperti PCI-DSS dan OWASP).

**Masalah:** Membaca berkas log utuh ke memori dengan `fs.readFile()` lalu melakukan `split('\n')` akan menghabiskan heap memory hingga server crash (Out Of Memory) jika ukuran log mencapai beberapa gigabyte. Selain itu, jika masking dilakukan tanpa penanganan stream yang defensif, pemotongan baris di perbatasan chunk dapat merusak struktur JSON dan mematikan pipeline ingestion.

**Solusi:** Buat pipeline streaming berbasis `Transform` stream yang membaca data NDJSON per baris, mem-parsing objek JSON, menyamarkan (*masking*) field sensitif secara otomatis, dan mengalirkannya langsung ke destination writer menggunakan `pipeline` dari `node:stream/promises` dengan batas waktu `AbortSignal`.

```js
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Simulate incoming high-volume NDJSON stream chunks
const sampleLogs = [
  '{"id":"TX-101","action":"LOGIN","token":"secret-auth-token-123","amount":0}\n',
  '{"id":"TX-102","action":"PAYMENT","cardNumber":"4111222233334444","amount":150000}\n',
  '{"id":"TX-103","action":"LOGOUT","token":"secret-token-456","amount":0}\n',
];

// Transform stream for line-by-line parsing and on-the-fly PII sanitization
class LogSanitizerStream extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: false });
    this._buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // Accumulate text in buffer to safely handle lines split across chunk boundaries
    this._buffer += chunk.toString('utf8');
    const lines = this._buffer.split('\n');

    // Keep unfinished line segment in the buffer
    this._buffer = lines.pop();

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);

          // Mask authorization token
          if (entry.token) {
            entry.token = '***REDACTED***';
          }
          // Mask credit card number (keep first 4 and last 4 digits)
          if (entry.cardNumber) {
            const num = String(entry.cardNumber);
            entry.cardNumber = num.slice(0, 4) + '********' + num.slice(-4);
          }

          this.push(JSON.stringify(entry) + '\n');
        } catch (err) {
          return callback(new Error(`Invalid NDJSON line: ${err.message}`));
        }
      }
    }
    callback();
  }

  _flush(callback) {
    // Process remaining trailing record if not terminated by newline
    if (this._buffer.trim()) {
      try {
        const entry = JSON.parse(this._buffer);
        if (entry.token) entry.token = '***REDACTED***';
        this.push(JSON.stringify(entry) + '\n');
      } catch (err) {
        return callback(new Error(`Invalid NDJSON tail: ${err.message}`));
      }
    }
    callback();
  }
}

const source = Readable.from(sampleLogs);
const sanitizer = new LogSanitizerStream();
const collectedLogs = [];

const destination = new Writable({
  write(chunk, encoding, callback) {
    collectedLogs.push(chunk.toString('utf8'));
    callback();
  },
});

console.log('--- Processing Ingestion Pipeline ---');
await pipeline(source, sanitizer, destination, { signal: AbortSignal.timeout(3000) });
process.stdout.write(collectedLogs.join(''));
```

## Pitfalls

- Menggunakan `new Buffer()` (sudah deprecated dan memiliki celah keamanan) atau `Buffer.allocUnsafe()` tanpa inisialisasi nol. Alokasi uninitialized memory berisiko mengekspos byte data sensitif lama sistem (seperti token JWT atau password) ke pihak luar.
  ```js
  // ❌ Incorrect: exposes uninitialized memory bytes that may contain sensitive data
  const unsafeBuf = Buffer.allocUnsafe(16);

  // ✅ Correct: safely allocate clean zero-filled buffer
  const safeBuf = Buffer.alloc(16);
  ```
- Mengira `buffer.subarray()` menduplikasi data ke alokasi memori baru. Mengubah elemen pada `subarray` akan secara tidak sengaja memutasi buffer aslinya (*shared memory mutation*).
  ```js
  // ❌ Incorrect: mutating slice inadvertently corrupts original buffer data
  const original = Buffer.from('HelloWorld');
  const slice = original.subarray(0, 5);
  slice[0] = 74; // 'J' -> original becomes 'JelloWorld'

  // ✅ Correct: copy explicitly into independent buffer if isolation is required
  const copyBuf = Buffer.alloc(5);
  original.copy(copyBuf, 0, 0, 5);
  copyBuf[0] = 74; // original remains 'HelloWorld'
  ```
- Menghubungkan stream menggunakan `.pipe()` bawaan alih-alih `stream.pipeline()`. Jika terjadi error di salah satu stream di tengah jalan, `.pipe()` tidak menutup atau membersihkan stream lainnya, memicu kebocoran memori dan file descriptor menggantung (*resource leak*).
  ```js
  // ❌ Incorrect: pipe does not forward errors or destroy streams on failure
  readable.pipe(transform).pipe(writable);

  // ✅ Correct: pipeline handles auto-cleanup, error forwarding, and promise lifecycle
  await pipeline(readable, transform, writable);
  ```
- Mengabaikan sinyal *backpressure* saat memanggil `writable.write()` berulang kali tanpa mengecek nilai boolean dan event `'drain'`. Ini membuat seluruh chunk ditimbun di internal memory buffer Node.js hingga memicu lonjakan heap atau OOM crash.
  ```js
  // ❌ Incorrect: blind write loop ignores backpressure and exhausts memory
  for (const chunk of massiveDataset) {
    writable.write(chunk);
  }

  // ✅ Correct: pause write when write() returns false and resume on 'drain'
  for (const chunk of massiveDataset) {
    if (!writable.write(chunk)) {
      await new Promise((resolve) => writable.once('drain', resolve));
    }
  }
  ```
- Menjalankan pipeline tanpa batas waktu (*timeout*) atau `AbortSignal`. Jika sumber stream macet (misalnya koneksi socket TCP menggantung dari klien luar), pipeline akan tertahan di memori tanpa pernah selesai (*dangling stream*).
  ```js
  // ❌ Incorrect: hangs indefinitely if source network socket stalls
  await pipeline(remoteSocket, fileWriter);

  // ✅ Correct: guard pipeline with AbortSignal timeout
  await pipeline(remoteSocket, fileWriter, { signal: AbortSignal.timeout(5000) });
  ```

## Referensi

- [Node.js Docs: Buffer](https://nodejs.org/api/buffer.html) — dokumentasi resmi alokasi biner, encoding, dan manipulasi data mentah pada modul `node:buffer`
- [Node.js Docs: Stream](https://nodejs.org/api/stream.html) — dokumentasi resmi arsitektur streaming, jenis stream (Readable, Writable, Duplex, Transform), dan penanganan backpressure pada `node:stream`
- [Node.js Docs: Stream Promises](https://nodejs.org/api/stream.html#stream-promises-api) — dokumentasi resmi fungsi `pipeline` berbasis Promise pada submodul `node:stream/promises`
- [Node.js Docs: Stream Consumers](https://nodejs.org/api/webstreams.html#utility-consumer-functions) — utilitas pembacaan konsumsi stream (`text`, `json`, `buffer`) pada submodul `node:stream/consumers`
- [Node.js Docs: AbortController](https://nodejs.org/api/globals.html#class-abortcontroller) — standar pembatalan operasi asinkron via `AbortSignal` yang digunakan untuk mencegah hanging pipeline

---

Berikutnya: [06 - Timers & Async](../06-timers-async/README.md)
