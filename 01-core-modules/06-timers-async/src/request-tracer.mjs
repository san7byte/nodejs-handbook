import http from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';

const tracerStorage = new AsyncLocalStorage();

// Helper logger: Membaca traceId dari context aktif secara transparan
function logger(level, message) {
  const store = tracerStorage.getStore();
  const traceId = store?.traceId ?? 'SYSTEM';
  console.log(`[${traceId}] [${level}] ${message}`);
}

// Simulasi operasi database dengan perlindungan AbortSignal
async function simulateDatabaseQuery(durationMs, signal) {
  logger('INFO', 'Querying database...');
  await setTimeout(durationMs, null, { signal });
  return { status: 'success', rows: 5 };
}

// Server HTTP dengan isolasi context per request
const server = http.createServer(async (req, res) => {
  const traceId = req.headers['x-request-id'] || 'trace-default';
  const store = { traceId, startTime: Date.now() };

  await tracerStorage.run(store, async () => {
    logger('INFO', `Incoming request: ${req.url}`);

    try {
      // Normal: Pasang batas timeout 50ms untuk mitigasi request lambat
      const timeoutSignal = AbortSignal.timeout(50);
      const isSlow = req.url === '/slow';
      const delay = isSlow ? 100 : 20;

      const data = await simulateDatabaseQuery(delay, timeoutSignal);
      logger('INFO', 'Request completed successfully');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      // Edge-case: Tangani timeout SLA saat operasi melebihi batas waktu
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        logger('WARN', 'Request exceeded SLA timeout limit');
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gateway Timeout' }));
      } else {
        logger('ERROR', `Internal failure: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal Server Error' }));
      }
    }
  });
});

server.listen(0, async () => {
  const port = server.address().port;
  logger('INFO', `Server active on port ${port}`);

  // 1. Eksekusi request cepat (berhasil dalam SLA)
  await fetch(`http://localhost:${port}/fast`, {
    headers: { 'x-request-id': 'REQ-FAST-01' },
  });

  // 2. Eksekusi request lambat (memicu pembatalan timeout)
  await fetch(`http://localhost:${port}/slow`, {
    headers: { 'x-request-id': 'REQ-SLOW-02' },
  });

  server.close(() => {
    logger('INFO', 'Server closed cleanly');
  });
});
