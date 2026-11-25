import {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
} from 'node:timers';

// Normal: Menjadwalkan timeout dengan argumen tambahan
const timer = setTimeout(
  (label, value) => {
    console.log(`Timeout executed: ${label} = ${value}`);
  },
  50,
  'status',
  200,
);

// Normal: Menjadwalkan interval dan menghentikannya setelah 2 kali siklus
let counter = 0;
const interval = setInterval(() => {
  counter += 1;
  console.log(`Interval tick: ${counter}`);
  if (counter >= 2) {
    clearInterval(interval);
    console.log('Interval cleared cleanly');
  }
}, 40);

// Edge-case: Membatalkan timer sebelum sempat dieksekusi
const canceledTimer = setTimeout(() => {
  console.log('This will not execute');
}, 30);
clearTimeout(canceledTimer);
console.log('Canceled timer successfully');

// Edge-case: Unref background timer agar tidak menahan proses Node.js
const backgroundTimer = setTimeout(() => {
  console.log('Background task running');
}, 5000);
backgroundTimer.unref();
console.log('Background timer unreferenced');
