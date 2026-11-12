import { EventEmitter, errorMonitor } from 'node:events';

const bus = new EventEmitter();

// Normal: Menggunakan errorMonitor untuk mencatat telemetri/audit tanpa mengonsumsi error
bus.on(errorMonitor, (err) => {
  console.log('[Audit Log] Monitored error occurrence:', err.message);
});

// Normal: Menangani event 'error' secara aman dengan listener khusus
bus.on('error', (err) => {
  console.log('[Error Handler] Gracefully handled error:', err.message);
});

// Memancarkan error saat listener terdaftar (tidak menyebabkan unhandled crash)
bus.emit('error', new Error('Database connection timeout'));

// Edge-case: Memancarkan 'error' pada emitter yang tidak memiliki listener 'error'
const unhandledBus = new EventEmitter();

// errorMonitor tetap bisa menyadap sebelum crash terjadi
unhandledBus.on(errorMonitor, (err) => {
  console.log('[Audit Log Unhandled] Sensed error before throw:', err.message);
});

try {
  // Tanpa listener 'error', pemanggilan emit('error') langsung melempar exception
  unhandledBus.emit('error', new Error('Fatal socket failure'));
} catch (err) {
  console.log('[Caught Exception] Prevented crash from missing error listener:', err.message);
}
