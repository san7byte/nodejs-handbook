import process from 'node:process';

// 1. Metrik penggunaan memori dan durasi aktif (uptime)
const mem = process.memoryUsage();
const uptime = process.uptime();
console.log('Heap used exists:', typeof mem.heapUsed === 'number');
console.log('Uptime is number:', typeof uptime === 'number');

// 2. Benchmark presisi tinggi dengan deteksi ambang batas (edge-case)
const start = process.hrtime.bigint();

// Simulasi beban kerja komputasi
for (let i = 0; i < 500_000; i++) Math.sqrt(i);

const elapsedNs = process.hrtime.bigint() - start; // Nanodetik (ns)
const elapsedMs = Number(elapsedNs) / 1_000_000; // Milidetik (ms)
const isTooSlow = elapsedMs > 200; // Edge-case: peringatan jika melampaui ambang batas 200ms

console.log('Elapsed ms is positive:', elapsedMs > 0);
console.log('Exceeded 200ms threshold:', isTooSlow);
