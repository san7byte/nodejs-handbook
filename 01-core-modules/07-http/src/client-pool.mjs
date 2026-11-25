import http from 'node:http';

// Normal: server target untuk menerima pemanggilan client
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

// Normal: konfigurasikan http.Agent untuk connection pooling dan keepAlive
const poolAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 5,
  maxFreeSockets: 2,
  timeout: 4000,
});

server.listen(0, () => {
  const { port } = server.address();

  // Normal: jalankan request GET menggunakan helper http.get
  http.get({ hostname: 'localhost', port, path: '/ping', agent: poolAgent }, (res) => {
    let raw = '';
    res.on('data', (chunk) => (raw += chunk));
    res.on('end', () => {
      const data = JSON.parse(raw);
      console.log('GET /ping status:', res.statusCode);
      console.log('GET /ping response:', data.message);

      // Normal: kirim request POST dengan payload body via http.request
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

            // Edge-case: pembatalan request menggunakan clientRequest.destroy()
            const cancelReq = http.request({
              hostname: 'localhost',
              port,
              path: '/ping',
              agent: poolAgent,
            });

            cancelReq.on('error', (err) => {
              console.log('Canceled request error caught:', err.message);

              // Cleanup: hancurkan agent dan tutup server
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
