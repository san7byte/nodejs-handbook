import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.url === '/chunked') {
    // Normal: konfigurasi header respons sebelum dikirim
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('X-Temporary', 'will-be-removed');

    console.log('Has temporary header:', res.hasHeader('X-Temporary'));
    res.removeHeader('X-Temporary');
    console.log(
      'Has temporary header after removal:',
      res.hasHeader('X-Temporary'),
    );
    console.log('Retrieved Content-Type:', res.getHeader('content-type'));

    // Normal: periksa apakah header sudah terkirim ke socket
    console.log('Headers sent before writeHead:', res.headersSent);

    // Normal: kirim status code dan header tambahan via writeHead
    res.writeHead(200, { 'X-Stream-Source': 'node-http' });
    console.log('Headers sent after writeHead:', res.headersSent);

    // Edge-case: proteksi agar tidak mengubah header setelah terkirim
    try {
      res.setHeader('X-Late-Header', 'invalid');
    } catch (err) {
      console.log(
        'Setting late header threw error:',
        err.code === 'ERR_HTTP_HEADERS_SENT',
      );
    }

    // Normal: streaming data potongan demi potongan lalu tutup
    res.write('Chunk 1: Hello ');
    res.write('Chunk 2: World');
    res.end(' [DONE]');
    return;
  }

  // Edge-case: tangani endpoint status 204 (No Content) tanpa body
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
  console.log(
    'Chunked custom header:',
    chunkedRes.headers.get('x-stream-source'),
  );
  console.log('Chunked body:', chunkedBody);

  // Test request 2: 204 No Content response
  const emptyRes = await fetch(`http://localhost:${port}/no-content`);
  console.log('No-content status:', emptyRes.status);

  server.close(() => {
    console.log('Response headers server closed');
  });
});
