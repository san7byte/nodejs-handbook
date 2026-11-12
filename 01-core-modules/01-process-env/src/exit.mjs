import process from 'node:process';

function shutdown(hasFatalCrash) {
  if (hasFatalCrash) {
    console.error('Fatal crash: emergency exit immediately');
    process.exit(1); // Keluar seketika, melewatkan tugas yang tertunda
  }

  console.warn('Recoverable validation error: setting exitCode');
  process.exitCode = 1; // Membiarkan operasi asinkron atau event loop selesai secara bersih
}

// Edge-case: error yang dapat dipulihkan membiarkan event loop keluar secara alami
shutdown(false);
console.log('Event loop still alive. ExitCode:', process.exitCode);
