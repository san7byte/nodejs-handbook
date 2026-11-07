import process from 'node:process';

function shutdown(hasFatalCrash) {
  if (hasFatalCrash) {
    console.error('Fatal crash: emergency exit immediately');
    process.exit(1); // Terminates immediately, skipping pending tasks
  }

  console.warn('Recoverable validation error: setting exitCode');
  process.exitCode = 1; // Allows async operations or event loop to finish cleanly
}

// Edge-case test: recoverable error allows loop to exit naturally
shutdown(false);
console.log('Event loop still alive. ExitCode:', process.exitCode);
