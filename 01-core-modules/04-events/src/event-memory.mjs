import { EventEmitter } from 'node:events';

const bus = new EventEmitter();

// Normal: Memeriksa batas default listener (default 10)
console.log('Default max listeners:', bus.getMaxListeners());

// Normal: Mengubah batas listener menjadi 3 untuk memantau potensi kebocoran memori
bus.setMaxListeners(3);
console.log('Custom max listeners:', bus.getMaxListeners());

// Normal: Mendaftarkan beberapa listener dan menghitung total aktif
const taskListenerA = () => {};
const taskListenerB = () => {};
bus.on('task', taskListenerA);
bus.on('task', taskListenerB);
console.log('Active task listeners:', bus.listenerCount('task'));

// Edge-case: Menghapus listener untuk event spesifik
bus.removeAllListeners('task');
console.log(
  'Task listeners after specific removal:',
  bus.listenerCount('task'),
);

// Edge-case: Membersihkan seluruh event sekaligus dari instance emitter
bus.on('metric:cpu', () => {});
bus.on('metric:ram', () => {});
console.log(
  'CPU listeners before global flush:',
  bus.listenerCount('metric:cpu'),
);
console.log(
  'RAM listeners before global flush:',
  bus.listenerCount('metric:ram'),
);

bus.removeAllListeners();
console.log(
  'CPU listeners after global flush:',
  bus.listenerCount('metric:cpu'),
);
console.log(
  'RAM listeners after global flush:',
  bus.listenerCount('metric:ram'),
);
