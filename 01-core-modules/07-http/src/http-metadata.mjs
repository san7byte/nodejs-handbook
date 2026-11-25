import http from 'node:http';

// Normal: periksa konstanta batas ukuran header bawaan Node.js
console.log('Max header size is number:', typeof http.maxHeaderSize === 'number');
console.log('Max header size value > 0:', http.maxHeaderSize > 0);

// Normal: eksplorasi daftar method yang didukung runtime
console.log('Is GET supported method:', http.METHODS.includes('GET'));
console.log('Is POST supported method:', http.METHODS.includes('POST'));
console.log('Is PURGE supported method:', http.METHODS.includes('PURGE'));
console.log('Is INVALID_METHOD supported:', http.METHODS.includes('INVALID_METHOD'));

// Normal: pembacaan deskripsi resmi status code HTTP
console.log('200 description:', http.STATUS_CODES[200]);
console.log('404 description:', http.STATUS_CODES[404]);
console.log('405 description:', http.STATUS_CODES[405]);

// Edge-case: fallback deskripsi untuk kode status yang tidak terdaftar
const unknownCode = 999;
const fallbackMessage = http.STATUS_CODES[unknownCode] || 'Unknown Status';
console.log('999 description fallback:', fallbackMessage);

// Normal: server yang memanfaatkan http.METHODS dan http.STATUS_CODES
const ALLOWED_METHODS = ['GET', 'POST'];

const server = http.createServer((req, res) => {
  // Edge-case: validasi method terhadap spesifikasi HTTP
  if (!http.METHODS.includes(req.method)) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: http.STATUS_CODES[501] }));
    return;
  }

  // Edge-case: tolak method yang tidak diizinkan pada endpoint ini (405 Method Not Allowed)
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

  // Test 1: Method yang diizinkan (GET)
  const okRes = await fetch(`http://localhost:${port}`);
  const okData = await okRes.json();
  console.log('Allowed method status:', okRes.status, okData.message);

  // Test 2: Method standar tapi tidak diizinkan di endpoint (DELETE -> 405)
  const notAllowedRes = await fetch(`http://localhost:${port}`, { method: 'DELETE' });
  const notAllowedData = await notAllowedRes.json();
  console.log('Not allowed status:', notAllowedRes.status, notAllowedData.error);
  console.log('Allow header:', notAllowedRes.headers.get('allow'));

  server.close(() => {
    console.log('HTTP metadata server closed');
  });
});
