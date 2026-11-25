# HTTP

> Membangun server web tangguh, mengelola daur hidup stream request dan response, mengoptimalkan connection pooling dengan Agent, serta mengamankan pertukaran data jaringan menggunakan modul bawaan `node:http`.

## Kenapa Perlu?

Aplikasi backend modern membutuhkan komunikasi jaringan berbasis protokol HTTP untuk melayani antarmuka web, API RESTful, maupun komunikasi antar-layanan pada arsitektur microservices. Walaupun framework tingkat tinggi banyak digunakan, menguasai modul `node:http` memberikan pemahaman mendalam tentang cara Node.js menangani transmisi header non-blocking, manipulasi stream biner, efisiensi soket TCP melalui connection pooling, serta pencegahan kerentanan kritis seperti resource starvation dan DoS.

## Konsep Inti

- Modul `node:http` bekerja di atas layer TCP (`node:net`) dengan arsitektur berbasis event loop, di mana server memancarkan event seperti `'request'`, `'connection'`, dan `'close'`.
- Request (`http.IncomingMessage`) adalah `Readable` stream yang mengalirkan potongan data (*chunks*) secara bertahap, sementara response (`http.ServerResponse`) adalah `Writable` stream yang harus ditutup secara eksplisit via `res.end()` agar koneksi tidak menggantung.
- Header HTTP dikirim mendahului data body; setelah header dialirkan ke socket, properti `res.headersSent` bernilai `true` dan header tidak dapat lagi diubah.
- `http.Agent` mengelola *connection pooling* dan mekanisme TCP *keep-alive* untuk menghemat biaya overhead pembuatan koneksi berulang pada pemanggilan client HTTP.
- Metadata bawaan runtime seperti `http.STATUS_CODES` dan `http.METHODS` menyediakan kamus standar IANA dan HTTP parser untuk standarisasi protokol secara konsisten tanpa library tambahan.

## Langkah 1: Membuat HTTP Server dan Mengelola Siklus Hidup Koneksi

Kita menginisialisasi server HTTP pada port dinamis, memeriksa informasi alamat jaringan socket, mengonfigurasi batas waktu timeout koneksi, dan menutup server secara graceful.

Buat file `server-lifecycle.mjs`.

```js
import http from 'node:http';

// Normal: create HTTP server instance with requestListener callback
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js HTTP server');
});

// Edge-case: configure socket timeout for idle or slow network connections
server.setTimeout(3000, (socket) => {
  console.log('Socket timeout reached, closing socket');
  socket.destroy();
});

// Normal: bind server to dynamic port 0 to prevent port collisions
server.listen(0, async () => {
  const addr = server.address();
  console.log('Server is listening:', typeof addr === 'object');
  console.log('Server port type:', typeof addr.port);
  console.log('Server family defined:', Boolean(addr.family));

  // Normal: send request to active listening server
  const response = await fetch(`http://localhost:${addr.port}`);
  const text = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body:', text);

  // Cleanup: gracefully close server
  server.close(() => {
    console.log('Server closed successfully');
  });
});
```

Jalankan file:

```bash
node server-lifecycle.mjs
```

Output:

```
Server is listening: true
Server port type: number
Server family defined: true
Response status: 200
Response body: Hello from Node.js HTTP server
Server closed successfully
```

Fungsi `http.createServer()` menghasilkan instance `http.Server`. Menentukan port `0` pada `server.listen()` memerintahkan sistem operasi mengalokasikan port lokal yang sedang bebas, yang kemudian dibaca lewat `server.address()`. Pemanggilan `server.setTimeout()` mengamankan server dari koneksi idle yang menahan file descriptor, dan `server.close()` menghentikan penerimaan koneksi baru seraya menyelesaikan koneksi yang sedang berlangsung.

## Langkah 2: Menavigasi Header Respons dan Mengontrol Aliran Pengiriman Data

Kita menetapkan, memeriksa, dan menghapus header respons, mengamati flag `headersSent`, mengalirkan potongan body bertahap menggunakan `write()`, serta menangani respons khusus tanpa konten.

Buat file `response-headers.mjs`.

```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.url === '/chunked') {
    // Normal: configure response headers before transmission
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('X-Temporary', 'will-be-removed');

    console.log('Has temporary header:', res.hasHeader('X-Temporary'));
    res.removeHeader('X-Temporary');
    console.log('Has temporary header after removal:', res.hasHeader('X-Temporary'));
    console.log('Retrieved Content-Type:', res.getHeader('content-type'));

    // Normal: check if response headers have been flushed to network
    console.log('Headers sent before writeHead:', res.headersSent);

    // Normal: send status code and additional headers via writeHead
    res.writeHead(200, { 'X-Stream-Source': 'node-http' });
    console.log('Headers sent after writeHead:', res.headersSent);

    // Edge-case: protect against modifying headers after they have been sent
    try {
      res.setHeader('X-Late-Header', 'invalid');
    } catch (err) {
      console.log('Setting late header threw error:', err.code === 'ERR_HTTP_HEADERS_SENT');
    }

    // Normal: stream data chunks progressively and close connection
    res.write('Chunk 1: Hello ');
    res.write('Chunk 2: World');
    res.end(' [DONE]');
    return;
  }

  // Edge-case: handle 204 No Content response without body payload
  if (req.url === '/no-content') {
    res.writeHead(204);
    res.end();
    return;
  }

  res.writeHead(404).end('Not Found');
});

server.listen(0, async () => {
  const { port } = server.address();

  // Test request 1: Chunked stream response
  const chunkedRes = await fetch(`http://localhost:${port}/chunked`);
  const chunkedBody = await chunkedRes.text();
  console.log('Chunked status:', chunkedRes.status);
  console.log('Chunked custom header:', chunkedRes.headers.get('x-stream-source'));
  console.log('Chunked body:', chunkedBody);

  // Test request 2: 204 No Content response
  const emptyRes = await fetch(`http://localhost:${port}/no-content`);
  console.log('No-content status:', emptyRes.status);

  server.close(() => {
    console.log('Response headers server closed');
  });
});
```

Jalankan file:

```bash
node response-headers.mjs
```

Output:

```
Has temporary header: true
Has temporary header after removal: false
Retrieved Content-Type: text/plain
Headers sent before writeHead: false
Headers sent after writeHead: true
Setting late header threw error: true
Chunked status: 200
Chunked custom header: node-http
Chunked body: Chunk 1: Hello Chunk 2: World [DONE]
No-content status: 204
Response headers server closed
```

Method `res.setHeader()` menampung header dalam buffer internal sebelum dikirimkan ke jaringan, sedangkan `res.removeHeader()` membatalkan header sebelum flush. Saat `res.writeHead()` atau `res.write()` dipanggil, header langsung dikirimkan ke socket sehingga `res.headersSent` berubah menjadi `true`, dan manipulasi header berikutnya akan memicu exception `ERR_HTTP_HEADERS_SENT`.

## Langkah 3: Menangani Parsing Body Stream dan Validasi Input Request

Kita membaca metadata routing request, mengumpulkan chunk data biner dari stream `IncomingMessage`, menerapkan batas ukuran payload untuk mitigasi DoS, serta memvalidasi struktur JSON.

Buat file `request-stream.mjs`.

```js
import http from 'node:http';

const MAX_PAYLOAD_BYTES = 100; // Defensive payload size threshold to mitigate DoS

const server = http.createServer((req, res) => {
  // Normal: inspect request metadata
  const method = req.method;
  const url = req.url;
  const contentType = req.headers['content-type'];

  if (method === 'POST' && url === '/upload') {
    // Edge-case: inspect Content-Length header if provided by client
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload Too Large' }));
      req.destroy(); // Abort incoming stream to prevent resource exhaustion
      return;
    }

    const chunks = [];
    let receivedBytes = 0;

    req.on('data', (chunk) => {
      receivedBytes += chunk.length;

      // Edge-case: safeguard against streaming chunk overflow exceeding limit
      if (receivedBytes > MAX_PAYLOAD_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      // Ignore end event if stream was already destroyed
      if (res.writableEnded) return;

      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(rawBody || '{}');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          received: parsed,
          contentType,
        }));
      } catch (err) {
        // Edge-case: gracefully handle malformed JSON payload
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON syntax' }));
      }
    });

    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(0, async () => {
  const { port } = server.address();

  // Test 1: Normal valid JSON payload
  const validRes = await fetch(`http://localhost:${port}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: 'book', quantity: 2 }),
  });
  const validData = await validRes.json();
  console.log('Valid upload status:', validRes.status);
  console.log('Received item:', validData.received.item);

  // Test 2: Edge-case - Malformed JSON payload
  const malformedRes = await fetch(`http://localhost:${port}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ bad-json-format: true ',
  });
  const malformedData = await malformedRes.json();
  console.log('Malformed upload status:', malformedRes.status);
  console.log('Malformed error:', malformedData.error);

  // Test 3: Edge-case - Payload too large exceeding limit
  const largeRes = await fetch(`http://localhost:${port}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'A'.repeat(200) }),
  });
  console.log('Large upload status:', largeRes.status);

  server.close(() => {
    console.log('Request stream server closed');
  });
});
```

Jalankan file:

```bash
node request-stream.mjs
```

Output:

```
Valid upload status: 200
Received item: book
Malformed upload status: 400
Malformed error: Malformed JSON syntax
Large upload status: 413
Request stream server closed
```

Objek `req` adalah `Readable` stream yang memancarkan buffer per bagian lewat event `'data'`. Penggabungan dengan `Buffer.concat()` menjaga integritas karakter multi-byte UTF-8. Pemeriksaan ambang batas ukuran data mencegah serangan kehabisan memori (*memory exhaustion*), di mana pemanggilan `req.destroy()` memutus transmisi jaringan seketika sebelum beban berlebih membebani event loop.

## Langkah 4: Melakukan Request Client dengan Connection Pooling dan Keep-Alive

Kita mengonfigurasi `http.Agent` untuk mengelola penggunaan ulang koneksi socket TCP, mengeksekusi request client via `http.get()` dan `http.request()`, serta menangani pembatalan request.

Buat file `client-pool.mjs`.

```js
import http from 'node:http';

// Normal: target HTTP server receiving client requests
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'pong' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/echo') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ echoed: JSON.parse(body) }));
    });
    return;
  }

  res.writeHead(404).end('Not Found');
});

// Normal: configure http.Agent for socket reuse and connection pooling
const poolAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 4000,
});

server.listen(0, () => {
  const { port } = server.address();

  // Normal: execute GET request using http.get helper
  http.get({ hostname: 'localhost', port, path: '/ping', agent: poolAgent }, (res) => {
    let raw = '';
    res.on('data', (chunk) => (raw += chunk));
    res.on('end', () => {
      const data = JSON.parse(raw);
      console.log('GET /ping status:', res.statusCode);
      console.log('GET /ping response:', data.message);

      // Normal: execute POST request with payload body via http.request
      const postReq = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/echo',
          method: 'POST',
          agent: poolAgent,
          headers: { 'Content-Type': 'application/json' },
        },
        (postRes) => {
          let postRaw = '';
          postRes.on('data', (chunk) => (postRaw += chunk));
          postRes.on('end', () => {
            const postData = JSON.parse(postRaw);
            console.log('POST /echo status:', postRes.statusCode);
            console.log('POST /echo response:', postData.echoed.role);

            // Edge-case: cancel request using clientRequest.destroy()
            const cancelReq = http.request({
              hostname: 'localhost',
              port,
              path: '/ping',
              agent: poolAgent,
            });

            cancelReq.on('error', (err) => {
              console.log('Canceled request error caught:', err.message);

              // Cleanup: destroy agent pool and terminate server
              poolAgent.destroy();
              server.close(() => {
                console.log('Client pool server closed');
              });
            });

            cancelReq.destroy(new Error('Operation canceled by client'));
          });
        }
      );

      postReq.write(JSON.stringify({ role: 'admin' }));
      postReq.end();
    });
  });
});
```

Jalankan file:

```bash
node client-pool.mjs
```

Output:

```
GET /ping status: 200
GET /ping response: pong
POST /echo status: 200
POST /echo response: admin
Canceled request error caught: Operation canceled by client
Client pool server closed
```

Instance `http.Agent` mempertahankan koneksi socket terbuka setelah request selesai melalui `keepAlive: true`, memangkas overhead TCP handshake pada pemanggilan berulang. Helper `http.get()` secara otomatis memanggil `.end()`, sedangkan `http.request()` memberi fleksibilitas streaming payload via `.write()`. Pembatalan dengan `.destroy()` memancarkan event `'error'` yang wajib ditangkap agar tidak memicu unhandled rejection.

## Langkah 5: Memanfaatkan Metadata Standar HTTP dan Pemetaan Status Code

Kita memanfaatkan konstanta `http.STATUS_CODES`, `http.METHODS`, serta batas `http.maxHeaderSize` untuk memvalidasi metode HTTP dan menyusun respons status terstandarisasi.

Buat file `http-metadata.mjs`.

```js
import http from 'node:http';

// Normal: inspect runtime maximum HTTP header size limit
console.log('Max header size is number:', typeof http.maxHeaderSize === 'number');
console.log('Max header size value > 0:', http.maxHeaderSize > 0);

// Normal: inspect supported HTTP methods in Node.js parser
console.log('Is GET supported method:', http.METHODS.includes('GET'));
console.log('Is POST supported method:', http.METHODS.includes('POST'));
console.log('Is PURGE supported method:', http.METHODS.includes('PURGE'));
console.log('Is INVALID_METHOD supported:', http.METHODS.includes('INVALID_METHOD'));

// Normal: lookup official HTTP status code descriptions
console.log('200 description:', http.STATUS_CODES[200]);
console.log('404 description:', http.STATUS_CODES[404]);
console.log('405 description:', http.STATUS_CODES[405]);

// Edge-case: provide safe fallback for unregistered status code
const unknownCode = 999;
const fallbackMessage = http.STATUS_CODES[unknownCode] || 'Unknown Status';
console.log('999 description fallback:', fallbackMessage);

// Normal: HTTP server utilizing http.METHODS and http.STATUS_CODES
const ALLOWED_METHODS = ['GET', 'POST'];

const server = http.createServer((req, res) => {
  // Edge-case: validate method against global HTTP specification
  if (!http.METHODS.includes(req.method)) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: http.STATUS_CODES[501] }));
    return;
  }

  // Edge-case: reject methods not permitted for this endpoint (405 Method Not Allowed)
  if (!ALLOWED_METHODS.includes(req.method)) {
    res.setHeader('Allow', ALLOWED_METHODS.join(', '));
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: http.STATUS_CODES[405] }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 200,
    message: http.STATUS_CODES[200],
    method: req.method,
  }));
});

server.listen(0, async () => {
  const { port } = server.address();

  // Test 1: Allowed HTTP method (GET)
  const okRes = await fetch(`http://localhost:${port}`);
  const okData = await okRes.json();
  console.log('Allowed method status:', okRes.status, okData.message);

  // Test 2: Standard method but disallowed on endpoint (DELETE -> 405)
  const notAllowedRes = await fetch(`http://localhost:${port}`, { method: 'DELETE' });
  const notAllowedData = await notAllowedRes.json();
  console.log('Not allowed status:', notAllowedRes.status, notAllowedData.error);
  console.log('Allow header:', notAllowedRes.headers.get('allow'));

  server.close(() => {
    console.log('HTTP metadata server closed');
  });
});
```

Jalankan file:

```bash
node http-metadata.mjs
```

Output:

```
Max header size is number: true
Max header size value > 0: true
Is GET supported method: true
Is POST supported method: true
Is PURGE supported method: true
Is INVALID_METHOD supported: false
200 description: OK
404 description: Not Found
405 description: Method Not Allowed
999 description fallback: Unknown Status
Allowed method status: 200 OK
Not allowed status: 405 Method Not Allowed
Allow header: GET, POST
HTTP metadata server closed
```

Array `http.METHODS` merangkum seluruh kata kunci metode HTTP standar yang dipahami oleh parser internal C++ Node.js. Objek `http.STATUS_CODES` berfungsi sebagai kamus deskripsi resmi HTTP status phrase tanpa memerlukan dependensi kamus pihak ketiga, sedangkan `http.maxHeaderSize` menandai ambang batas byte header request yang diterima server sebelum memutus koneksi dengan status `431 Request Header Fields Too Large`.

## Referensi API

| API | Fungsi |
|---|---|
| `http.createServer([options][, requestListener])` | Membuat instance `http.Server` baru. `options` (object, opsional), `requestListener` (function `(req, res)`, opsional). Returns `http.Server`. |
| `server.listen([port[, host[, callback]]])` | Mengikat server ke port dan host untuk mulai menerima request. `port` (number, opsional, default `0`), `host` (string, opsional), `callback` (function, opsional). Returns `http.Server`. |
| `server.close([callback])` | Menghentikan server dari menerima koneksi baru dan menutup koneksi aktif secara bertahap. `callback` (function, opsional). Returns `http.Server`. |
| `server.address()` | Mengembalikan informasi alamat jaringan (port, address, family) yang sedang diikat oleh server. Returns `object \| string \| null`. |
| `server.setTimeout([msecs][, callback])` | Mengatur batas waktu timeout koneksi socket server sebelum diputus. `msecs` (number, opsional, default `120000`), `callback` (function, opsional). Returns `http.Server`. |
| `res.setHeader(name, value)` | Menetapkan satu header HTTP untuk antrean respons sebelum header dikirim. `name` (string, wajib), `value` (string \| number \| string[], wajib). Returns `http.ServerResponse`. |
| `res.getHeader(name)` / `res.hasHeader(name)` | Membaca atau memeriksa keberadaan header respons tertentu secara case-insensitive. `name` (string, wajib). Returns `string \| number \| string[] \| undefined` / `boolean`. |
| `res.removeHeader(name)` | Menghapus header tertentu dari daftar respons sebelum dikirim. `name` (string, wajib). Returns `void`. |
| `res.headersSent` | Properti penanda apakah header HTTP respons telah terkirim ke jaringan client. Returns `boolean`. |
| `res.writeHead(statusCode[, statusMessage][, headers])` | Mengirim status code, status message, dan header HTTP langsung ke socket. `statusCode` (number, wajib), `statusMessage` (string, opsional), `headers` (object \| Array, opsional). Returns `http.ServerResponse`. |
| `res.write(chunk[, encoding][, callback])` | Mengalirkan potongan data buffer atau string ke body respons secara bertahap. `chunk` (string \| Buffer, wajib), `encoding` (string, opsional), `callback` (function, opsional). Returns `boolean`. |
| `res.end([data[, encoding]][, callback])` | Mengirim data terakhir dan menutup stream respons HTTP. `data` (string \| Buffer, opsional), `encoding` (string, opsional), `callback` (function, opsional). Returns `http.ServerResponse`. |
| `req.method` | Properti string yang merepresentasikan metode HTTP request (misalnya `'GET'`, `'POST'`). Returns `string`. |
| `req.url` | Properti string yang berisi path dan query string mentah dari incoming request. Returns `string`. |
| `req.headers` | Objek pasangan key-value nama header request dalam format lowercase. Returns `object`. |
| `req.destroy([error])` | Menghancurkan stream incoming request seketika dan menutup koneksi socket. `error` (Error, opsional). Returns `http.IncomingMessage`. |
| `http.request(url[, options][, callback])` | Membuat client request HTTP untuk mengirim permintaan data ke server target. `url` (string \| URL, opsional), `options` (object, opsional), `callback` (function `(res)`, opsional). Returns `http.ClientRequest`. |
| `http.get(url[, options][, callback])` | Helper praktis untuk request GET client yang otomatis memanggil `req.end()`. `url` (string \| URL, opsional), `options` (object, opsional), `callback` (function `(res)`, opsional). Returns `http.ClientRequest`. |
| `new http.Agent([options])` | Mengelola *connection pooling* dan mekanisme TCP *keep-alive* untuk request client HTTP. `options` (object `{ keepAlive, maxSockets, maxFreeSockets, timeout }`, opsional). Returns `http.Agent`. |
| `http.STATUS_CODES` | Kamus pemetaan standar status code HTTP 3-digit ke deskripsi teks bahasa Inggris. Returns `Object`. |
| `http.METHODS` | Daftar array string seluruh HTTP method yang didukung oleh parser C++ Node.js. Returns `string[]`. |
| `http.maxHeaderSize` | Batas maksimum ukuran byte header HTTP yang diizinkan untuk dibaca parser. Returns `number`. |

## Kasus di Aplikasi

Pada arsitektur microservices backend, API Gateway atau Reverse Proxy bertindak sebagai gerbang terdepan untuk menerima traffic client, menyuntikkan header pelacak korelasi (*correlation ID*), dan meneruskannya (*forwarding*) ke backend upstream secara streaming tanpa memuat seluruh body ke memori server.

**Masalah:** Memuat seluruh body request atau respons upstream ke dalam memori proxy (misalnya via buffer string utuh) sebelum diteruskan memicu lonjakan konsumsi RAM ekstrem (*memory spike*) dan memperlambat latensi *Time-To-First-Byte* (TTFB). Selain itu, jika server upstream mendadak mati atau menolak koneksi, proxy yang tidak memiliki penanganan error yang baik akan mengalami crash akibat unhandled error atau membiarkan koneksi client menggantung (*socket hang up*).

**Solusi:** Buat reverse proxy native yang menggunakan `pipeline` dari `node:stream` untuk mengalirkan stream request client langsung ke upstream `http.request`, serta mengalirkan respons upstream kembali ke client. Proxy menyuntikkan header pelacak `x-forwarded-for` dan `x-correlation-id`, serta menangani kegagalan jaringan upstream secara defensif dengan mengembalikan respons `502 Bad Gateway`.

```js
import http from 'node:http';
import { pipeline } from 'node:stream';

// 1. Upstream Server (Internal Backend Service)
const upstreamServer = http.createServer((req, res) => {
  const correlationId = req.headers['x-correlation-id'] || 'none';

  if (req.url === '/api/orders' && req.method === 'POST') {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const order = JSON.parse(raw);
      res.writeHead(201, {
        'Content-Type': 'application/json',
        'X-Upstream-Processed': 'true',
        'X-Correlation-ID': correlationId,
      });
      res.end(JSON.stringify({ orderId: 'ORD-12345', item: order.item }));
    });
    return;
  }

  res.writeHead(404).end('Upstream Not Found');
});

// 2. Reverse Proxy Server
function createReverseProxy(upstreamPort) {
  return http.createServer((clientReq, clientRes) => {
    // Normal: inject correlation ID for distributed tracing
    const correlationId = clientReq.headers['x-correlation-id'] || `corr-${Date.now()}`;

    // Normal: configure forwarding options to upstream target
    const options = {
      hostname: 'localhost',
      port: upstreamPort,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `localhost:${upstreamPort}`,
        'x-forwarded-for': clientReq.socket.remoteAddress || '127.0.0.1',
        'x-correlation-id': correlationId,
      },
    };

    // Normal: dispatch request to upstream backend
    const upstreamReq = http.request(options, (upstreamRes) => {
      // Normal: mirror upstream status code and headers to client response
      clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);

      // Normal: pipe upstream response stream back to client
      pipeline(upstreamRes, clientRes, (err) => {
        if (err && !clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
          clientRes.end(JSON.stringify({ error: 'Bad Gateway: Upstream response streaming failed' }));
        }
      });
    });

    // Edge-case: handle network failure or dead upstream server gracefully
    upstreamReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({
          error: 'Bad Gateway: Upstream service unavailable',
          code: err.code,
        }));
      }
    });

    // Normal: pipe client request payload directly into upstream request stream
    pipeline(clientReq, upstreamReq, (err) => {
      if (err) {
        upstreamReq.destroy();
      }
    });
  });
}

// 3. Execute end-to-end integration demo
upstreamServer.listen(0, () => {
  const upstreamPort = upstreamServer.address().port;
  const proxy = createReverseProxy(upstreamPort);

  proxy.listen(0, async () => {
    const proxyPort = proxy.address().port;

    // Normal: client submits order request through reverse proxy
    const response = await fetch(`http://localhost:${proxyPort}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': 'TRACE-PROD-999',
      },
      body: JSON.stringify({ item: 'Microservice Handbook', quantity: 1 }),
    });

    const data = await response.json();
    console.log('Proxy forwarded status:', response.status);
    console.log('Processed by upstream:', response.headers.get('x-upstream-processed'));
    console.log('Correlation ID retained:', response.headers.get('x-correlation-id'));
    console.log('Created order ID:', data.orderId);

    // Edge-case: test behavior when upstream server is down (unreachable port)
    const deadProxy = createReverseProxy(9999);
    deadProxy.listen(0, async () => {
      const deadProxyPort = deadProxy.address().port;
      const deadRes = await fetch(`http://localhost:${deadProxyPort}/api/orders`);
      const deadData = await deadRes.json();
      console.log('Dead upstream status:', deadRes.status);
      console.log('Dead upstream error:', deadData.error);

      // Cleanup: close all active servers
      deadProxy.close();
      proxy.close();
      upstreamServer.close(() => {
        console.log('All proxy demonstration servers closed');
      });
    });
  });
});
```

## Pitfalls

- Lupa memanggil `res.end()` pada akhir penanganan request. Client (seperti browser atau HTTP client) akan terus menunggu (*timeout*) tanpa henti, dan koneksi socket di server akan tertahan sehingga menghabiskan *file descriptor*.
  ```js
  // ❌ Incorrect: response stream never closed, client hangs indefinitely
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify({ status: 'ok' }));
    // Missing res.end()
  });

  // ✅ Correct: always finalize response stream with res.end()
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  });
  ```
- Menetapkan atau memodifikasi header respons setelah data terkirim (`ERR_HTTP_HEADERS_SENT`). Pemanggilan `writeHead()`, `write()`, atau `end()` langsung mengalirkan baris header ke jaringan; memodifikasi header sesudahnya akan melempar exception fatal.
  ```js
  // ❌ Incorrect: setting header after response headers have been sent
  http.createServer((req, res) => {
    res.writeHead(200);
    res.setHeader('Content-Type', 'application/json'); // Throws ERR_HTTP_HEADERS_SENT
    res.end('ok');
  });

  // ✅ Correct: verify res.headersSent or set headers prior to sending body
  http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  });
  ```
- Mengabaikan penanganan event `'error'` pada instance `http.ClientRequest`. Jika terjadi kegagalan jaringan seperti `ECONNREFUSED` atau host tidak ditemukan, ketiadaan listener `'error'` akan diperlakukan sebagai unhandled error yang mematikan seluruh proses Node.js.
  ```js
  // ❌ Incorrect: missing error listener crashes process on connection failure
  const req = http.request('http://localhost:9999/api', (res) => {
    res.on('data', () => {});
  });
  req.end();

  // ✅ Correct: always attach error listener to client request
  const req = http.request('http://localhost:9999/api', (res) => {
    res.on('data', () => {});
  });
  req.on('error', (err) => {
    console.error('Request failed gracefully:', err.message);
  });
  req.end();
  ```
- Membaca seluruh data payload request ke memori tanpa batasan ukuran (*unbounded body reading*). Membiarkan stream masuk dikonsumsi tanpa batas memudahkan serangan Denial of Service (DoS) yang memicu *heap out of memory* (OOM).
  ```js
  // ❌ Incorrect: collecting unbounded incoming chunks directly into memory
  let body = '';
  req.on('data', (chunk) => {
    body += chunk; // Vulnerable to memory exhaustion (DoS)
  });

  // ✅ Correct: enforce maximum byte threshold and destroy stream when exceeded
  const MAX_BYTES = 1024 * 1024; // 1 MB limit
  let totalBytes = 0;
  req.on('data', (chunk) => {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload Too Large' }));
      req.destroy();
    }
  });
  ```

## Referensi

- [Node.js Docs: HTTP](https://nodejs.org/api/http.html) — dokumentasi resmi modul `node:http`, kelas `http.Server`, `IncomingMessage`, `ServerResponse`, dan `http.Agent`.
- [Node.js Docs: Stream](https://nodejs.org/api/stream.html) — dokumentasi resmi modul `node:stream` dan utility `pipeline` untuk pengaliran data asinkron antar stream.
- [Node.js Docs: Buffer](https://nodejs.org/api/buffer.html) — dokumentasi alokasi data biner dan metode `Buffer.concat()` untuk penggabungan chunk request.
- [Node.js Docs: Errors](https://nodejs.org/api/errors.html#err_http_headers_sent) — panduan penanganan error sistem Node.js dan exception `ERR_HTTP_HEADERS_SENT`.

---

Berikutnya: [08 - Crypto](../08-crypto/README.md)
