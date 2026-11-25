import http from 'node:http';

const MAX_PAYLOAD_BYTES = 100; // Batas defensif ukuran payload untuk mencegah DoS

const server = http.createServer((req, res) => {
  // Normal: inspeksi metadata request
  const method = req.method;
  const url = req.url;
  const contentType = req.headers['content-type'];

  if (method === 'POST' && url === '/upload') {
    // Edge-case: periksa Content-Length header jika client mengirimkannya
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_PAYLOAD_BYTES) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload Too Large' }));
      req.destroy(); // Hancurkan stream request untuk menghentikan transmisi client
      return;
    }

    const chunks = [];
    let receivedBytes = 0;

    req.on('data', (chunk) => {
      receivedBytes += chunk.length;

      // Edge-case: proteksi jika streaming chunk melebihi batas toleransi
      if (receivedBytes > MAX_PAYLOAD_BYTES) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      // Jika request sudah di-destroy karena payload terlalu besar, abaikan event end
      if (res.writableEnded) return;

      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        const parsed = JSON.parse(rawBody || '{}');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            received: parsed,
            contentType,
          }),
        );
      } catch (err) {
        // Edge-case: tangani parsing JSON yang rusak (malformed JSON)
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
