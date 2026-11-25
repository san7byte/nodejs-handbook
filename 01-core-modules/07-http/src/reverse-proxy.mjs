import http from 'node:http';
import { pipeline } from 'node:stream';

// 1. Upstream Server (Layanan Backend Internal)
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
    // Normal: injeksi pelacak korelasi (correlation ID)
    const correlationId = clientReq.headers['x-correlation-id'] || `corr-${Date.now()}`;

    // Normal: persiapkan opsi forwarding ke upstream
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

    // Normal: buat request ke upstream server
    const upstreamReq = http.request(options, (upstreamRes) => {
      // Normal: salin status code dan headers dari upstream ke client
      clientRes.writeHead(upstreamRes.statusCode, upstreamRes.headers);

      // Normal: alirkan body respons upstream ke client via streaming pipeline
      pipeline(upstreamRes, clientRes, (err) => {
        if (err && !clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
          clientRes.end(JSON.stringify({ error: 'Bad Gateway: Upstream response streaming failed' }));
        }
      });
    });

    // Edge-case: tangani kegagalan koneksi jika upstream tidak merespons atau mati
    upstreamReq.on('error', (err) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({
          error: 'Bad Gateway: Upstream service unavailable',
          code: err.code,
        }));
      }
    });

    // Normal: alirkan payload request dari client langsung ke upstream request
    pipeline(clientReq, upstreamReq, (err) => {
      if (err) {
        upstreamReq.destroy();
      }
    });
  });
}

// 3. Jalankan demonstrasi end-to-end
upstreamServer.listen(0, () => {
  const upstreamPort = upstreamServer.address().port;
  const proxy = createReverseProxy(upstreamPort);

  proxy.listen(0, async () => {
    const proxyPort = proxy.address().port;

    // Normal: client mengirim order melalui Reverse Proxy
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

    // Edge-case: uji skenario upstream tidak tersedia (port mati)
    const deadProxy = createReverseProxy(9999);
    deadProxy.listen(0, async () => {
      const deadProxyPort = deadProxy.address().port;
      const deadRes = await fetch(`http://localhost:${deadProxyPort}/api/orders`);
      const deadData = await deadRes.json();
      console.log('Dead upstream status:', deadRes.status);
      console.log('Dead upstream error:', deadData.error);

      // Cleanup: tutup seluruh server
      deadProxy.close();
      proxy.close();
      upstreamServer.close(() => {
        console.log('All proxy demonstration servers closed');
      });
    });
  });
});
