# Zlib (Kompresi & Dekompresi)

> Mengompresi dan mendekompresi data menggunakan algoritma Gzip, Deflate, Brotli, serta memvalidasi integritas payload biner dengan checksum CRC32 di Node.js.

## Kenapa Perlu?

Pengiriman payload data teks mentah berukuran besar pada REST API atau komunikasi antar server memboroskan bandwidth jaringan dan memperlambat respons aplikasi ke klien. Tanpa kompresi data, biaya transfer data cloud meningkat dan throughput server menurun drastis saat menangani volume lalu lintas tinggi. Modul bawaan `node:zlib` menyediakan algoritma kompresi lossless berkinerja tinggi serta Transform stream untuk streaming kompresi realtime tanpa membebani memori server.

## Konsep Inti

- Modul bawaan `node:zlib` diimpor eksplisit menggunakan `import zlib from 'node:zlib'`.
- Gzip dan Deflate adalah algoritma kompresi standar berbasis DEFLATE yang didukung secara universal oleh hampir semua HTTP client dan browser.
- Brotli menawarkan rasio kompresi lebih efisien daripada Gzip untuk data teks, namun membutuhkan alokasi CPU lebih besar saat proses kompresi awal.
- Streaming kompresi menggunakan Transform stream (seperti `createGzip` atau `createBrotliCompress`) wajib dipadukan dengan `pipeline()` untuk menjaga kestabilan memori melalui manajemen backpressure.
- Fungsi `zlib.crc32()` menghitung nilai checksum 32-bit secara native untuk mendeteksi korupsi atau manipulasi data biner sebelum dan sesudah transmisi.

## Langkah 1: Kompresi dan Dekompresi Buffer dengan Gzip

Kita mengompresi payload data dalam memori menggunakan algoritma Gzip, memulihkan data aslinya dengan gunzip, serta menangani data biner yang rusak.

Buat file `gzip.mjs`.

```js
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Normal: compress and decompress buffer data
const sourceText = 'Fast and scalable backend systems with Node.js';
const sourceBuffer = Buffer.from(sourceText);

const compressed = await gzip(sourceBuffer, { level: 6 });
const decompressed = await gunzip(compressed);

console.log('Original bytes:', sourceBuffer.length);
console.log('Compressed bytes:', compressed.length);
console.log('Decompressed text:', decompressed.toString());

// Edge-case: handle corrupted or invalid compressed buffer
const corruptedBuffer = Buffer.from('not-a-valid-gzip-stream');
try {
  await gunzip(corruptedBuffer);
} catch (err) {
  console.log('Corrupted data error code:', err.code);
}
```

Jalankan file:

```bash
node gzip.mjs
```

Output:

```
Original bytes: 46
Compressed bytes: 64
Decompressed text: Fast and scalable backend systems with Node.js
Corrupted data error code: Z_DATA_ERROR
```

Fungsi `zlib.gzip()` mengompresi buffer ke format Gzip standar dengan opsi level kompresi 1 hingga 9. Jika buffer yang diberikan ke `zlib.gunzip()` tidak memiliki header Gzip valid atau terpotong, Node.js melempar error dengan kode `Z_DATA_ERROR` yang harus ditangkap menggunakan blok `try...catch`.

## Langkah 2: Kompresi Rasio Tinggi dengan Brotli

Kita memanfaatkan algoritma Brotli untuk memperoleh rasio kompresi maksimal pada payload teks dan membatasi alokasi memori dekompresi untuk mencegah serangan denial-of-service.

Buat file `brotli.mjs`.

```js
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

// Normal: high-ratio compression with Brotli text mode
const payload = 'Node.js handbook explains Brotli compression parameters '.repeat(10);
const inputBuffer = Buffer.from(payload);

const compressed = await brotliCompress(inputBuffer, {
  params: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_DEFAULT_QUALITY,
  },
});
const decompressed = await brotliDecompress(compressed);

console.log('Original length:', inputBuffer.length);
console.log('Brotli compressed length:', compressed.length);
console.log('Restored text matches:', decompressed.toString() === payload);

// Edge-case: zip-bomb defense using maxOutputLength limit
try {
  await brotliDecompress(compressed, { maxOutputLength: 100 });
} catch (err) {
  console.log('Zip-bomb safeguard triggered:', err.code);
}
```

Jalankan file:

```bash
node brotli.mjs
```

Output:

```
Original length: 560
Brotli compressed length: 53
Restored text matches: true
Zip-bomb safeguard triggered: ERR_BUFFER_TOO_LARGE
```

Konfigurasi parameter Brotli seperti mode teks dan tingkat kualitas memungkinkan optimasi kompresi secara mendalam. Pada kondisi edge-case di mana payload hasil dekompresi melampaui ambang batas keamanan yang ditentukan di `maxOutputLength`, Node.js langsung menghentikan dekompresi dengan kode `ERR_BUFFER_TOO_LARGE` untuk melindungi memori server dari decompression bomb.

## Langkah 3: Streaming Kompresi dengan Transform Stream

Kita mengalirkan chunk data secara bertahap melalui Transform stream `createGzip` dan `createGunzip` menggunakan `pipeline()` untuk menjaga penggunaan memori tetap rendah dan menangani kegagalan aliran data.

Buat file `stream.mjs`.

```js
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Normal: stream data chunks through createGzip and createGunzip
const sourceChunks = ['Stream chunk 1 | ', 'Stream chunk 2 | ', 'Stream chunk 3'];
const outputChunks = [];

await pipeline(
  Readable.from(sourceChunks),
  zlib.createGzip({ level: 6 }),
  zlib.createGunzip(),
  async function* (source) {
    for await (const chunk of source) {
      outputChunks.push(chunk.toString());
    }
  }
);

console.log('Streamed result:', outputChunks.join(''));

// Edge-case: handle stream pipeline error during corrupted chunk ingestion
const corruptSource = [Buffer.from([0x1f, 0x8b, 0xff, 0xff])];
try {
  await pipeline(
    Readable.from(corruptSource),
    zlib.createGunzip(),
    async function* (source) {
      for await (const chunk of source) {
        // Discard chunk
      }
    }
  );
} catch (err) {
  console.log('Pipeline error caught:', err.code);
}
```

Jalankan file:

```bash
node stream.mjs
```

Output:

```
Streamed result: Stream chunk 1 | Stream chunk 2 | Stream chunk 3
Pipeline error caught: Z_DATA_ERROR
```

Fungsi `zlib.createGzip()` dan `zlib.createGunzip()` menghasilkan instance Transform stream yang memproses data per potongan buffer tanpa menumpuk seluruh file di memori. Membungkus aliran stream ke dalam `pipeline()` memastikan seluruh stream segera ditutup dan dibersihkan ketika terjadi kegagalan chunk atau error dekompresi.

## Langkah 4: Dekompresi Fleksibel Menggunakan createUnzip

Kita memanfaatkan `createUnzip` untuk mendekompresi payload secara otomatis tanpa perlu mengetahui terlebih dahulu apakah sumber data dikompresi dengan format Gzip atau Deflate.

Buat file `unzip.mjs`.

```js
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

async function streamDecompress(stream) {
  const chunks = [];
  await pipeline(stream, zlib.createUnzip(), async function* (source) {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).toString();
}

// Normal: createUnzip transparently decompresses both Deflate and Gzip streams
const sampleText = 'Universal decompression with createUnzip';

// 1. Deflate compression
const deflateChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createDeflate(),
  async function* (source) {
    for await (const chunk of source) deflateChunks.push(chunk);
  }
);
const deflatedBuffer = Buffer.concat(deflateChunks);

// 2. Gzip compression
const gzipChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createGzip(),
  async function* (source) {
    for await (const chunk of source) gzipChunks.push(chunk);
  }
);
const gzippedBuffer = Buffer.concat(gzipChunks);

const fromDeflate = await streamDecompress(Readable.from(deflatedBuffer));
const fromGzip = await streamDecompress(Readable.from(gzippedBuffer));

console.log('Decompressed from Deflate:', fromDeflate);
console.log('Decompressed from Gzip:', fromGzip);

// Edge-case: invalid header stream passed to createUnzip
try {
  await streamDecompress(Readable.from(Buffer.from('not-a-valid-archive-header')));
} catch (err) {
  console.log('Auto-unzip error code:', err.code);
}
```

Jalankan file:

```bash
node unzip.mjs
```

Output:

```
Decompressed from Deflate: Universal decompression with createUnzip
Decompressed from Gzip: Universal decompression with createUnzip
Auto-unzip error code: Z_DATA_ERROR
```

Instance Transform stream dari `zlib.createUnzip()` mendeteksi header secara otomatis untuk menentukan apakah stream terkompresi memakai Gzip atau Deflate. Jika header data yang masuk tidak cocok dengan signature format mana pun, stream akan memancarkan error `Z_DATA_ERROR` yang tertangkap secara aman oleh promise `pipeline`.

## Langkah 5: Verifikasi Integritas Data Menggunakan CRC32

Kita menghitung checksum CRC32 secara langsung maupun bertahap untuk memvalidasi bahwa data biner tidak mengalami korupsi atau perubahan selama transmisi.

Buat file `crc.mjs`.

```js
import zlib from 'node:zlib';

// Normal: compute CRC32 checksum for buffer and verify data integrity
const originalData = Buffer.from('Database backup payload 2026');
const checksum = zlib.crc32(originalData);

// Incremental checksum calculation across stream chunks
const chunk1 = Buffer.from('Database backup ');
const chunk2 = Buffer.from('payload 2026');
const incrementalChecksum = zlib.crc32(chunk2, zlib.crc32(chunk1));

console.log('Single-pass CRC32:', checksum);
console.log('Incremental matches single-pass:', incrementalChecksum === checksum);

// Edge-case: detect altered data through checksum mismatch
const tamperedData = Buffer.from('Database backup payload 2027');
const tamperedChecksum = zlib.crc32(tamperedData);
const isIntact = tamperedChecksum === checksum;

console.log('Tampered data is valid:', isIntact);
console.log('Empty buffer CRC32:', zlib.crc32(Buffer.alloc(0)));
```

Jalankan file:

```bash
node crc.mjs
```

Output:

```
Single-pass CRC32: 1378017387
Incremental matches single-pass: true
Tampered data is valid: false
Empty buffer CRC32: 0
```

Method `zlib.crc32()` menghasilkan bilangan unsigned 32-bit yang merepresentasikan checksum data biner. Argumen kedua yang bersifat opsional memungkinkan penghitungan checksum secara bertahap (incremental) pada data streaming, sementara perubahan sekecil satu byte akan langsung mengubah total checksum sehingga data yang rusak dapat segera dideteksi.

## Referensi API

| API | Fungsi |
|---|---|
| `zlib.gzip(buffer[, options], callback)` | Mengompresi buffer data menggunakan algoritma Gzip. `buffer` (`Buffer \| string \| DataView`, wajib) adalah data sumber, `options` (`object`, opsional) mengatur level dan konfigurasi kompresi, `callback` (`Function`, wajib) menerima hasil buffer terkompresi. Returns `void` (atau `Promise<Buffer>` via promisify). |
| `zlib.gunzip(buffer[, options], callback)` | Mendekompresi buffer data Gzip kembali ke bentuk aslinya. `buffer` (`Buffer \| TypedArray \| DataView`, wajib) adalah data biner terkompresi, `options` (`object`, opsional) mengatur batas buffer seperti `maxOutputLength`, `callback` (`Function`, wajib) menerima hasil dekompresi. Returns `void` (atau `Promise<Buffer>` via promisify). |
| `zlib.brotliCompress(buffer[, options], callback)` | Mengompresi buffer data menggunakan algoritma Brotli dengan rasio kompresi tinggi. `buffer` (`Buffer \| string \| DataView`, wajib) adalah data sumber, `options` (`object`, opsional) berisi dictionary `params` parameter Brotli, `callback` (`Function`, wajib) menerima hasil kompresi. Returns `void` (atau `Promise<Buffer>` via promisify). |
| `zlib.brotliDecompress(buffer[, options], callback)` | Mendekompresi buffer data terkompresi Brotli. `buffer` (`Buffer \| TypedArray \| DataView`, wajib) adalah data sumber, `options` (`object`, opsional) mengatur batasan alokasi, `callback` (`Function`, wajib) menerima buffer hasil ekstraksi. Returns `void` (atau `Promise<Buffer>` via promisify). |
| `zlib.createGzip([options])` | Membuat instance Transform stream untuk mengompresi aliran data menggunakan algoritma Gzip. `options` (`object`, opsional) mengatur konfigurasi stream seperti `level` dan `chunkSize`. Returns `Gzip` (Transform stream). |
| `zlib.createGunzip([options])` | Membuat instance Transform stream untuk mendekompresi aliran data Gzip secara bertahap. `options` (`object`, opsional) mengatur parameter stream. Returns `Gunzip` (Transform stream). |
| `zlib.createDeflate([options])` | Membuat instance Transform stream untuk mengompresi aliran data menggunakan format Deflate. `options` (`object`, opsional) mengatur parameter kompresi zlib. Returns `Deflate` (Transform stream). |
| `zlib.createInflate([options])` | Membuat instance Transform stream untuk mendekompresi aliran data Deflate. `options` (`object`, opsional) mengatur opsi alokasi stream. Returns `Inflate` (Transform stream). |
| `zlib.createUnzip([options])` | Membuat instance Transform stream yang secara otomatis mendeteksi format header Gzip atau Deflate untuk didekompresi. `options` (`object`, opsional) mengatur konfigurasi stream. Returns `Unzip` (Transform stream). |
| `zlib.crc32(data[, value])` | Menghitung checksum integritas data 32-bit dari buffer atau string. `data` (`Buffer \| TypedArray \| DataView \| string`, wajib) adalah payload yang dihitung, `value` (`number`, opsional) adalah nilai CRC32 sebelumnya untuk kalkulasi bertahap. Returns `number` (bilangan bulat 32-bit). |

## Kasus di Aplikasi

**Masalah:** Endpoint REST API menyajikan payload JSON analitik berukuran besar yang memakan kuota bandwidth dan memperlambat rendering aplikasi pada koneksi jaringan lambat karena tidak mendukung negosiasi kompresi konten secara dinamis.

**Solusi:** Membangun server HTTP dengan negosiasi header `Accept-Encoding`, mengompresi payload secara streaming menggunakan `pipeline()` sesuai format terbaik yang didukung klien (Brotli, Gzip, atau Deflate), serta menyematkan header `Content-Encoding` dan `Vary`.

Buat file `http-compression.mjs`.

```js
import http from 'node:http';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Create HTTP server with dynamic content-encoding negotiation
const server = http.createServer(async (req, res) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const payload = JSON.stringify({
    status: 'success',
    timestamp: 1774300800000,
    records: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, metric: 'latency_ms', value: 12.5 })),
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Accept-Encoding');

  // Negotiate best compression format: brotli (br) > gzip > deflate > plain
  let compressor = null;
  if (/\bbr\b/.test(acceptEncoding)) {
    res.setHeader('Content-Encoding', 'br');
    compressor = zlib.createBrotliCompress();
  } else if (/\bgzip\b/.test(acceptEncoding)) {
    res.setHeader('Content-Encoding', 'gzip');
    compressor = zlib.createGzip({ level: 6 });
  } else if (/\bdeflate\b/.test(acceptEncoding)) {
    res.setHeader('Content-Encoding', 'deflate');
    compressor = zlib.createDeflate();
  }

  try {
    if (compressor) {
      await pipeline(Readable.from(payload), compressor, res);
    } else {
      res.end(payload);
    }
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Compression error');
  }
});

server.listen(0, async () => {
  const { port } = server.address();

  // Client 1: requests Brotli compression
  const brRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'br' },
  });
  console.log('Client 1 Content-Encoding:', brRes.headers.get('content-encoding'));

  // Client 2: requests Gzip compression
  const gzRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  console.log('Client 2 Content-Encoding:', gzRes.headers.get('content-encoding'));

  // Client 3: no compression supported (identity)
  const plainRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'identity' },
  });
  console.log('Client 3 Content-Encoding:', plainRes.headers.get('content-encoding') ?? 'identity');

  const json = await gzRes.json();
  console.log('Decompressed records count:', json.records.length);

  server.close();
});
```

Jalankan file:

```bash
node http-compression.mjs
```

Output:

```
Client 1 Content-Encoding: br
Client 2 Content-Encoding: gzip
Client 3 Content-Encoding: identity
Decompressed records count: 50
```

## Pitfalls

- Mengompresi ulang file biner media yang sudah terkompresi (seperti `.png`, `.jpg`, `.mp4`, atau `.zip`). Kompresi ulang pada data dengan entropi tinggi justru membuang siklus CPU dan sering kali memperbesar ukuran file.
  ```js
  // ❌ Incorrect: compressing already compressed media assets
  // await gzip(imageBuffer);

  // ✅ Correct: verify MIME type before initiating compression
  function isCompressible(mimeType) {
    return /^(text\/|application\/(json|javascript|xml|wasm))/.test(mimeType);
  }
  console.log('Compress SVG:', isCompressible('text/xml')); // true
  console.log('Compress JPEG:', isCompressible('image/jpeg')); // false
  ```
- Mendekompresi payload yang tidak tepercaya tanpa batas alokasi memori (kerentanan zip-bomb / memory exhaustion DoS).
  ```js
  // ❌ Incorrect: decompressing unlimited untrusted payload directly into memory
  // const data = await gunzip(untrustedUntestedPayload);

  // ✅ Correct: define maxOutputLength to prevent memory exhaustion attacks
  const safeBuffer = await gunzip(untrustedPayload, { maxOutputLength: 10 * 1024 * 1024 });
  ```
- Menggunakan level kompresi maksimal (`level: 9` pada Gzip atau `BROTLI_MAX_QUALITY: 11` pada Brotli) untuk respons HTTP realtime. Peningkatan level maksimal menaikkan latensi CPU server hingga berkali-kali lipat hanya untuk penghematan byte yang sangat marjinal.
  ```js
  // ❌ Incorrect: maximum quality for dynamic on-the-fly HTTP responses
  // const stream = zlib.createBrotliCompress({ params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } });

  // ✅ Correct: balanced compression level for high throughput runtime APIs
  const stream = zlib.createBrotliCompress({
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
  });
  ```
- Mengalirkan stream menggunakan `.pipe()` manual tanpa penanganan error dan siklus hidup stream yang terisolasi. Jika terjadi kegagalan kompresi di tengah jalan, koneksi soket akan menggantung dan menyebabkan kebocoran memori (memory leak).
  ```js
  // ❌ Incorrect: legacy pipe does not clean up downstream streams on error
  // readableStream.pipe(zlib.createGzip()).pipe(responseStream);

  // ✅ Correct: use pipeline() for automatic backpressure management and stream teardown
  await pipeline(readableStream, zlib.createGzip(), responseStream);
  ```

## Referensi

- [Node.js Documentation: Zlib](https://nodejs.org/api/zlib.html) - Dokumentasi resmi modul inti `node:zlib` untuk kompresi, dekompresi, dan algoritma hashing CRC32.
- [Node.js Documentation: Stream](https://nodejs.org/api/stream.html) - Dokumentasi modul pendukung `node:stream` untuk pengelolaan Transform stream dan fungsi utilitas `pipeline()`.
- [Node.js Documentation: HTTP](https://nodejs.org/api/http.html) - Dokumentasi modul pendukung `node:http` untuk pembangunan web server dan negosiasi header kompresi respons.
- [Node.js Documentation: Util Promisify](https://nodejs.org/api/util.html#utilpromisifyoriginal) - Dokumentasi modul pendukung `node:util` untuk mengubah callback fungsi kompresi menjadi Promise.

---

Berikutnya: [10 - Worker & Cluster](../10-worker-cluster/README.md)
