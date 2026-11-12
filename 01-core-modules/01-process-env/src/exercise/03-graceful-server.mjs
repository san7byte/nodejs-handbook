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
 * ┌───────────┬─────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                         │ Input                                                                  │ Expected                                                               │
 * ├───────────┼─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ new GracefulServer(options)         │ { serviceName: 'OrderSvc', drainDelayMs: 100 }                         │ Instance terbuat, isShuttingDown = false, drainDelayMs = 100           │
 * │ Normal 2  │ server.start()                      │ (tanpa argumen)                                                        │ Mendaftarkan listener SIGTERM/SIGINT, returns instance this            │
 * │ Normal 3  │ server.simulateSignal('SIGTERM')    │ 'SIGTERM'                                                              │ isShuttingDown = true, memanggil process.exit(0) setelah delay         │
 * │ Edge 1    │ new GracefulServer(options)         │ { serviceName: 'OrderSvc' }                                            │ drainDelayMs fallback ke default 200                                   │
 * │ Edge 2    │ server.stop('SIGINT')               │ Panggilan kedua setelah server.stop('SIGTERM')                         │ Idempoten, panggilan kedua diabaikan (tidak drain ulang)               │
 * │ Error 1   │ new GracefulServer(options)         │ {} atau { serviceName: 123 }                                           │ Lempar Error('serviceName is required and must be a string')           │
 * └───────────┴─────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Pengelola graceful shutdown server yang menangani sinyal terminasi sistem operasi.
 */
export class GracefulServer {
  /**
   * Menginisialisasi instance server dan konfigurasi sinyal terminasi.
   *
   * @param {{ serviceName: string, drainDelayMs?: number }} [option={}]
   */
  constructor(option = {}) {
    // 1. Validasi opsi konfigurasi server
    if (!option.serviceName || typeof option.serviceName !== 'string') {
      throw new Error('serviceName is required and must be a string');
    }

    this.isShuttingDown = false;
    this.serviceName = option.serviceName;
    this.drainDelayMs = option.drainDelayMs ?? 200;
  }

  /**
   * Mendaftarkan listener sinyal SIGTERM dan SIGINT pada proses.
   *
   * @returns {this}
   */
  start() {
    // 2. Daftarkan handler sinyal terminasi OS (SIGTERM / SIGINT)
    process.on('SIGTERM', () => this.stop('SIGTERM'));
    process.on('SIGINT', () => this.stop('SIGINT'));
    return this;
  }

  /**
   * Menghentikan server secara aman dengan jeda drain delay sebelum keluar.
   *
   * @param {string} [signal]
   * @returns {void}
   */
  stop(signal) {
    // 3. Mencegah penanganan sinyal ganda (idempoten)
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    // 4. Beri jeda drain delay sebelum mematikan proses dengan process.exit(0)
    setTimeout(() => {
      process.exit(0);
    }, this.drainDelayMs);
  }

  /**
   * Menyimulasikan pengiriman sinyal OS ke proses Node.js.
   *
   * @param {string} signal
   * @returns {void}
   */
  simulateSignal(signal) {
    // 5. Emit sinyal ke proses untuk pengujian / simulasi
    process.emit(signal);
  }
}
