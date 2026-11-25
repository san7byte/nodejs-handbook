import http from 'node:http';

// Normal: inisialisasi HTTP server dengan callback requestListener
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js HTTP server');
});

// Edge-case: konfigurasi batas waktu timeout socket untuk koneksi lambat atau idle
server.setTimeout(3000, (socket) => {
  console.log('Socket timeout reached, closing socket');
  socket.destroy();
});

// Normal: ikat server ke port dinamis (0) agar bebas dari konflik port
server.listen(0, async () => {
  const addr = server.address();
  console.log('Server is listening:', typeof addr === 'object');
  console.log('Server port type:', typeof addr.port);
  console.log('Server family defined:', Boolean(addr.family));

  // Normal: kirim request ke server yang sedang aktif
  const response = await fetch(`http://localhost:${addr.port}`);
  const text = await response.text();
  console.log('Response status:', response.status);
  console.log('Response body:', text);

  // Cleanup: hentikan server secara graceful
  server.close(() => {
    console.log('Server closed successfully');
  });
});
