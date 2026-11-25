import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout } from 'node:timers/promises';

const als = new AsyncLocalStorage();

// Normal: Mengakses context di fungsi bersarang tanpa prop drilling
async function fetchUserOrders() {
  const store = als.getStore();
  const traceId = store?.get('traceId') ?? 'UNTRACKED';
  await setTimeout(20);
  return `Orders retrieved for trace: ${traceId}`;
}

// Normal: Menjalankan eksekusi di dalam context store Map
const result = await als.run(new Map([['traceId', 'TRACE-987']]), async () => {
  const store = als.getStore();
  console.log('1. Inside context store:', store.get('traceId'));
  const orders = await fetchUserOrders();
  console.log('2.', orders);

  // Edge-case: Mengisolasi eksekusi dengan als.exit() untuk melepas store aktif
  const isolated = als.exit(() => {
    const outsideStore = als.getStore();
    return outsideStore === undefined;
  });
  console.log('3. Store is undefined inside als.exit():', isolated);

  return 'Task completed';
});

console.log('4. Run result:', result);

// Edge-case: Membaca store di luar cakupan als.run() mengembalikan undefined
const fallbackStore = als.getStore();
console.log(
  '5. Store outside als.run is undefined:',
  fallbackStore === undefined,
);
