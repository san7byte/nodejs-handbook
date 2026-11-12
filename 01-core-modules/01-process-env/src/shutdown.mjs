import http from 'node:http';
import process from 'node:process';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server ready');
});

let isShuttingDown = false;

function setupGracefulShutdown(server) {
  function shutdown(signal) {
    // Mencegah penanganan sinyal ganda (idempoten)
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`Received ${signal}. Closing server...`);

    // Timer batas waktu: hentikan paksa jika proses pembersihan menggantung
    const forceTimer = setTimeout(() => {
      console.error('Force shutdown after timeout.');
      process.exit(1);
    }, 5000);
    forceTimer.unref();

    // Hentikan penerimaan koneksi baru dan selesaikan request aktif
    server.close(() => {
      console.log('HTTP server closed cleanly.');
      process.exitCode = 0;
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

setupGracefulShutdown(server);

server.listen(0, () => {
  console.log('Server is listening.');
  setTimeout(() => {
    process.emit('SIGINT');
  }, 6000);
});
