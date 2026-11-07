import process from 'node:process';

// 1. Handling POSIX signal
process.on('SIGINT', (signal) => {
  console.log('Received signal:', signal);
});

// 2. Edge-case: intercepting unhandled Promise rejection
process.on('unhandledRejection', (reason) => {
  console.error('Handled unhandledRejection safely:', reason.message);
  process.exitCode = 1;
});

// Test signal
process.emit('SIGINT', 'SIGINT');

// Test edge-case rejection
const rejectedPromise = Promise.reject(new Error('Database connection failed'));
process.emit(
  'unhandledRejection',
  new Error('Database connection failed'),
  rejectedPromise,
);
rejectedPromise.catch(() => {});
