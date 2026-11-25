import { setTimeout, setImmediate } from 'node:timers/promises';

console.log('1. Starting promise timers');

// Normal: await setTimeout mengembalikan payload hasil resolusi
const result = await setTimeout(30, 'Resolved payload');
console.log('2. setTimeout resolved:', result);

// Normal: await setImmediate menjadwalkan ke Check phase secara asinkron
const immediateResult = await setImmediate('Immediate ready');
console.log('3. setImmediate resolved:', immediateResult);

// Edge-case: Membatalkan timer Promise menggunakan AbortController
const controller = new AbortController();
const timeoutPromise = setTimeout(100, 'Never reached', { signal: controller.signal });

controller.abort();

try {
  await timeoutPromise;
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('4. Caught expected timer cancellation: AbortError');
  } else {
    throw err;
  }
}
