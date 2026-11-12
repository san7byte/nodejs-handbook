import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: Mendaftarkan listener reguler di urutan akhir antrean
bus.on('request', (id) => {
  console.log(`[Order 2] Processing business logic for ${id}`);
});

// Normal: Menyisipkan listener audit di posisi terdepan antrean
bus.prependListener('request', (id) => {
  console.log(`[Order 1] Security audit check for ${id}`);
});

// Edge-case: Menyisipkan listener sekali pakai di posisi paling awal
bus.prependOnceListener('request', (id) => {
  console.log(`[Priority First-Run] Bootstrap cache on initial request for ${id}`);
});

console.log('--- First Emit ---');
bus.emit('request', 'REQ-101');

console.log('--- Second Emit ---');
bus.emit('request', 'REQ-102');
