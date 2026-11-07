import process from 'node:process';

/**
 * ============================================================================
 * SOAL 03: Graceful Server Shutdown Manager
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Class `GracefulServer` bertugas mendengarkan sinyal terminasi sistem operasi
 *    (`SIGTERM` dan `SIGINT`), mencegah penanganan sinyal ganda (*shutdown idempotency*),
 *    memberikan jeda drain koneksi aktif secara aman (*drain delay*), lalu
 *    menghentikan proses Node.js dengan `process.exit(0)`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:process`: `process.on`, `process.emit`, `process.exit`, `process.pid`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. `constructor(option = {})`:
 *       - `option.serviceName` wajib ada dan bertipe string non-kosong. Jika tidak valid,
 *         lempar `Error('serviceName is required and must be a string')`.
 *       - `this.serviceName = option.serviceName`.
 *       - `this.drainDelayMs = option.drainDelayMs ?? 200`.
 *       - Properti status awal `this.isShuttingDown = false`.
 *    2. Method `start()`:
 *       - Daftarkan listener sinyal pada `process`:
 *         - Saat event `'SIGTERM'` terjadi, panggil `this.stop('SIGTERM')`.
 *         - Saat event `'SIGINT'` terjadi, panggil `this.stop('SIGINT')`.
 *       - Mengembalikan instance `this` (fluent interface).
 *    3. Method `stop(signal)`:
 *       - Idempotensi: Jika `this.isShuttingDown` sudah bernilai `true`, langsung abaikan
 *         dan return tanpa memicu drain ulang.
 *       - Set `this.isShuttingDown = true`.
 *       - Gunakan `setTimeout` sebesar `this.drainDelayMs`, lalu panggil `process.exit(0)`.
 *    4. Method `simulateSignal(signal)`:
 *       - Memicu event sinyal ke proses menggunakan `process.emit(signal)`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Method / Pemanggilan  │ Input Parameter                          │ Output / Expected Behavior                                             │
 * ├───────────┼───────────────────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ constructor           │ { serviceName: 'OrderSvc', drain: 100 }  │ Instance terbuat, isShuttingDown = false, drainDelayMs = 100           │
 * │ Normal 2  │ start()               │ -                                        │ Mendaftarkan listener SIGTERM/SIGINT, returns instance `this`           │
 * │ Normal 3  │ stop('SIGTERM')       │ 'SIGTERM'                                │ isShuttingDown berubah true, memanggil process.exit(0) setelah delay   │
 * │ Edge 1    │ constructor fallback  │ { serviceName: 'OrderSvc' }              │ drainDelayMs fallback ke default 200                                   │
 * │ Edge 2    │ stop() sinyal ganda   │ Panggilan stop() kedua saat shuttingDown │ Diabaikan (tidak memicu drain atau exit tambahan)                      │
 * │ Error 1   │ constructor           │ {} atau non-string serviceName           │ Lempar Error('serviceName is required and must be a string')           │
 * └───────────┴───────────────────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

export class GracefulServer {
  constructor(option = {}) {
    if (!option.serviceName || typeof option.serviceName !== 'string') {
      throw new Error('serviceName is required and must be a string');
    }

    this.isShuttingDown = false;
    this.serviceName = option.serviceName;
    this.drainDelayMs = option.drainDelayMs ?? 200;
  }

  start() {
    process.on('SIGTERM', () => this.stop('SIGTERM'));
    process.on('SIGINT', () => this.stop('SIGINT'));
    return this;
  }

  stop(signal) {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    setTimeout(() => {
      process.exit(0);
    }, this.drainDelayMs);
  }

  simulateSignal(signal) {
    process.emit(signal);
  }
}

// ============================================================================
// TEST RUNNER (ISOLATED)
// ============================================================================

let passedCount = 0;
let failedCount = 0;

const originalExit = process.exit;

function cleanupListeners() {
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
}

async function runTest(scenarioName, testFn) {
  try {
    cleanupListeners();
    await testFn();
    console.log(`[PASS] ${scenarioName}`);
    passedCount++;
  } catch (err) {
    console.log(`[FAIL] ${scenarioName}: ${err.message}`);
    failedCount++;
  } finally {
    cleanupListeners();
    process.exit = originalExit;
  }
}

async function runAllTests() {
  console.log('=== TEST SOAL 03: GracefulServer ===\n');

  // 1. Skenario Error 1: serviceName tidak ada atau bukan string
  await runTest('Skenario Error 1: Validasi serviceName pada Constructor', () => {
    let thrown = false;
    try {
      new GracefulServer();
    } catch (err) {
      thrown = true;
      if (err.message !== 'serviceName is required and must be a string') {
        throw new Error(`Expected 'serviceName is required and must be a string', got: ${err.message}`);
      }
    }
    if (!thrown) throw new Error('Harus melempar error saat option.serviceName kosong');
  });

  // 2. Skenario Normal 1: Inisialisasi dan default state
  await runTest('Skenario Normal 1: Inisialisasi Constructor & State Awal', () => {
    const server = new GracefulServer({ serviceName: 'OrderService', drainDelayMs: 150 });
    if (server.serviceName !== 'OrderService') throw new Error(`Expected OrderService, got ${server.serviceName}`);
    if (server.drainDelayMs !== 150) throw new Error(`Expected 150, got ${server.drainDelayMs}`);
    if (server.isShuttingDown !== false) throw new Error(`Expected isShuttingDown false, got ${server.isShuttingDown}`);
  });

  // 3. Skenario Edge 1: Default fallback drainDelayMs (200)
  await runTest('Skenario Edge 1: Fallback default drainDelayMs (200)', () => {
    const server = new GracefulServer({ serviceName: 'AuthService' });
    if (server.drainDelayMs !== 200) throw new Error(`Expected drainDelayMs 200, got ${server.drainDelayMs}`);
  });

  // 4. Skenario Normal 2: Method start() mendaftarkan listener dan return this
  await runTest('Skenario Normal 2: Method start() mendaftarkan Signal Listener', () => {
    const server = new GracefulServer({ serviceName: 'PaymentService' });
    const returned = server.start();
    if (returned !== server) throw new Error('start() harus mengembalikan instance this');
    if (process.listenerCount('SIGTERM') < 1) throw new Error('Harus mendaftarkan listener SIGTERM');
    if (process.listenerCount('SIGINT') < 1) throw new Error('Harus mendaftarkan listener SIGINT');
  });

  // 5. Skenario Edge 2: Idempotensi saat menerima sinyal ganda
  await runTest('Skenario Edge 2: Idempotensi Penanganan Sinyal Ganda', () => {
    const server = new GracefulServer({ serviceName: 'ReportService', drainDelayMs: 50 });
    server.stop('SIGTERM');
    if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus bernilai true setelah stop()');

    // Panggilan kedua tidak boleh melempar error dan harus diabaikan
    server.stop('SIGINT');
    if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus tetap true');
  });

  // 6. Skenario Normal 3: simulateSignal memicu safe exit setelah drainDelayMs
  await runTest('Skenario Normal 3: simulateSignal dan Safe Exit dengan delay', async () => {
    let exitCodeCalled = null;
    process.exit = (code) => {
      exitCodeCalled = code;
    };

    const server = new GracefulServer({ serviceName: 'GatewayService', drainDelayMs: 20 });
    server.start();
    server.simulateSignal('SIGTERM');

    if (server.isShuttingDown !== true) throw new Error('isShuttingDown harus true seketika saat sinyal diterima');

    // Tunggu drainDelayMs selesai
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (exitCodeCalled !== 0) throw new Error(`Expected process.exit(0) dipanggil, got: ${exitCodeCalled}`);
  });

  console.log('\n--------------------------------------------------');
  console.log(`Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`);
  console.log('--------------------------------------------------');

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

runAllTests();
