import process from 'node:process';

// 1. Menangani sinyal POSIX sistem operasi
process.on('SIGINT', (signal) => {
  console.log('Received signal:', signal);
});

// 2. Edge-case: mencegat Promise rejection yang tidak tertangani (unhandledRejection)
process.on('unhandledRejection', (reason) => {
  console.error('Handled unhandledRejection safely:', reason.message);
  process.exitCode = 1;
});

// Uji coba sinyal
process.emit('SIGINT', 'SIGINT');

// Uji coba edge-case rejection
const rejectedPromise = Promise.reject(new Error('Database connection failed'));
process.emit(
  'unhandledRejection',
  new Error('Database connection failed'),
  rejectedPromise,
);
rejectedPromise.catch(() => {});
