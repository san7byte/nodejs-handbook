import { setInterval } from 'node:timers/promises';

console.log('1. Starting interval stream');

// Normal: Mengonsumsi stream interval menggunakan for await...of dan break
let count = 0;
for await (const timestamp of setInterval(25, Date.now())) {
  count += 1;
  console.log(`2. Stream tick ${count} at: ${typeof timestamp}`);
  if (count >= 2) {
    break;
  }
}
console.log('3. Stream exited with break cleanly');

// Edge-case: Menghentikan interval stream menggunakan AbortSignal eksternal
const controller = new AbortController();
const signal = controller.signal;

try {
  let abortCount = 0;
  for await (const tick of setInterval(20, 'signal-tick', { signal })) {
    abortCount += 1;
    console.log(`4. Abort stream tick: ${abortCount}`);
    if (abortCount >= 1) {
      controller.abort();
    }
  }
} catch (err) {
  if (err.name === 'AbortError') {
    console.log('5. Handled interval stream abort safely');
  } else {
    throw err;
  }
}
