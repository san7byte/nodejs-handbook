import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: Mendaftarkan listener tetap dengan on()
function handleUserLogin(userId, role) {
  console.log(`User logged in: ${userId} (${role})`);
}
bus.on('user:login', handleUserLogin);

// Normal: Mendaftarkan listener satu kali pakai dengan once()
bus.once('app:ready', (version) => {
  console.log(`System initialized with version: ${version}`);
});

// Normal: Memancarkan event dengan emit() dan argumen payload
bus.emit('app:ready', '1.0.0');
bus.emit('app:ready', '1.0.1'); // Note: Tidak memicu listener karena once sudah dilepas

bus.emit('user:login', 'USR-001', 'ADMIN');

// Normal: Melepas listener spesifik dengan off()
bus.off('user:login', handleUserLogin);
bus.emit('user:login', 'USR-002', 'GUEST'); // Note: Tidak memicu listener karena sudah dilepas

// Edge-case: Memancarkan event yang tidak memiliki listener terdaftar
const hasOrderListeners = bus.emit('order:created', { id: 'ORD-99' });
console.log('Delivered to order listeners:', hasOrderListeners);

// Edge-case: Menghapus listener menggunakan referensi fungsi anonim baru (gagal dilepas)
bus.on('ping', () => console.log('PONG-1'));
bus.off('ping', () => console.log('PONG-1')); // Note: Referensi fungsi berbeda, listener tetap aktif
console.log('Active ping listeners:', bus.listenerCount('ping'));
