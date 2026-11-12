import { EventEmitter, once, on } from 'node:events';

const bus = new EventEmitter();

// Normal: Menunggu pemancaran event tunggal secara Promise dengan once()
setTimeout(() => {
  bus.emit('ready', { status: 'ONLINE', port: 3000 });
}, 10);

const [readyPayload] = await once(bus, 'ready');
console.log(
  `System status: ${readyPayload.status} on port ${readyPayload.port}`,
);

// Normal & Edge-case: Mengonsumsi stream event berulang via async iterator dengan sinyal pembatalan
const controller = new AbortController();
const { signal } = controller;

let counter = 0;
const intervalId = setInterval(() => {
  counter += 1;
  bus.emit('tick', counter);

  if (counter === 2) {
    // Edge-case: Membatalkan konsumsi event secara elegan menggunakan AbortController
    controller.abort();
    clearInterval(intervalId);
  }
}, 1000);

try {
  for await (const [count] of on(bus, 'tick', { signal })) {
    console.log(`Received tick count: ${count}`);
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('Async event stream closed gracefully via AbortSignal');
  } else {
    throw err;
  }
}
