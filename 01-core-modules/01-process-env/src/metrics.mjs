import process from 'node:process';

// 1. Memory and uptime metrics
const mem = process.memoryUsage();
const uptime = process.uptime();
console.log('Heap used exists:', typeof mem.heapUsed === 'number');
console.log('Uptime is number:', typeof uptime === 'number');

// 2. High-resolution benchmark with threshold detection (edge-case)
const start = process.hrtime.bigint();

// Simulate workload
for (let i = 0; i < 500_000; i++) Math.sqrt(i);

const elapsedNs = process.hrtime.bigint() - start; // Nanosecond (NS)
const elapsedMs = Number(elapsedNs) / 1_000_000; // Milisecond (MS)
const isTooSlow = elapsedMs > 200; // Edge-case threshold warning

console.log('Elapsed ms is positive:', elapsedMs > 0);
console.log('Exceeded 200ms threshold:', isTooSlow);
