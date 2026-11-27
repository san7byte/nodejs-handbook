import http from 'node:http';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Buat server HTTP dengan negosiasi kompresi konten secara dinamis
const server = http.createServer(async (req, res) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const payload = JSON.stringify({
    status: 'success',
    timestamp: 1774300800000,
    records: Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      metric: 'latency_ms',
      value: 12.5,
    })),
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Vary', 'Accept-Encoding');

  // Negosiasi algoritma kompresi terbaik: brotli (br) > gzip > deflate > plain
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

// Jalankan server pada port acak dan uji respons dengan berbagai Accept-Encoding
server.listen(0, async () => {
  const { port } = server.address();

  // Klien 1: meminta kompresi Brotli
  const brRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'br' },
  });
  console.log(
    'Client 1 Content-Encoding:',
    brRes.headers.get('content-encoding'),
  );

  // Klien 2: meminta kompresi Gzip
  const gzRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  console.log(
    'Client 2 Content-Encoding:',
    gzRes.headers.get('content-encoding'),
  );

  // Klien 3: tidak mendukung kompresi (identity)
  const plainRes = await fetch(`http://localhost:${port}`, {
    headers: { 'Accept-Encoding': 'identity' },
  });
  console.log(
    'Client 3 Content-Encoding:',
    plainRes.headers.get('content-encoding') ?? 'identity',
  );

  const json = await gzRes.json();
  console.log('Decompressed records count:', json.records.length);

  server.close();
});
