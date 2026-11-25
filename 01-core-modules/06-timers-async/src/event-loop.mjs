import process from 'node:process';

console.log('1. Synchronous START');

// Normal: Menjadwalkan immediate callback yang dieksekusi di fase Check
setImmediate(() => {
  console.log('4. setImmediate callback start');

  // Normal: Antrean microtask Promise di dalam callback
  queueMicrotask(() => {
    console.log('6. queueMicrotask inside immediate');
  });

  // Normal: Antrean tick berprioritas tinggi dieksekusi mendahului microtask lain
  // Note: Di dalam callback, nextTick selalu mendahului microtask V8. Namun pada top-level .mjs, modul dievaluasi dalam V8 Promise job sehingga queueMicrotask selesai lebih awal.
  process.nextTick(() => {
    console.log(
      '5. process.nextTick inside immediate (runs before queueMicrotask)',
    );
  });
});

// Normal: Timer macrotask dieksekusi setelah durasi waktu terpenuhi
setTimeout(() => {
  console.log('7. setTimeout completed');
}, 10);

// Edge-case: Membatalkan immediate sebelum fase Check dijalankan
const canceledImmediate = setImmediate(() => {
  console.log('This will not execute');
});
clearImmediate(canceledImmediate);
console.log('2. clearImmediate canceled successfully');

console.log('3. Synchronous END');
