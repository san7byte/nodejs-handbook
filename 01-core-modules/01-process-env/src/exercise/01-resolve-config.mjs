import process from 'node:process';

/**
 * ============================================================================
 * SOAL 01: Application Config & CLI Arguments Resolver
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Fungsi `resolveAppConfig(defaultPort = 3000)` bertugas memprioritaskan
 *    sumber konfigurasi port dari: CLI argument (`--port <val>`), lalu environment
 *    variable (`PORT`), dan fallback ke `defaultPort`. Selain itu, tentukan mode
 *    lingkungan runtime dari `NODE_ENV`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:process`: `process.argv`, `process.env`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Prioritas Nilai Port: CLI Flag `--port` > `process.env.PORT` > `defaultPort`.
 *    - Parsing CLI Arguments: Periksa apakah `--port` ada di `process.argv.slice(2)`.
 *      Jika ada, ambil nilai argumen persis setelahnya.
 *    - Validasi Port: Port wajib berupa integer valid di antara rentang 1 s.d. 65535.
 *      Jika nilai port bukan angka atau di luar batas (contoh: 0, 99999, 'abc'),
 *      lempar `Error('Invalid port number')`.
 *    - Penentuan Mode Environment:
 *      - Ambil `env` dari `process.env.NODE_ENV || 'development'`.
 *      - `isProduction` bernilai `true` jika `env === 'production'`, selain itu `false`.
 *    - Kembalikan objek: `{ port: number, env: string, isProduction: boolean }`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬─────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                         │ Input                                                                  │ Expected                                               │
 * ├───────────┼─────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
 * │ Normal 1  │ resolveAppConfig()                  │ argv: ['node', 'app.mjs'], env: {}, defaultPort: default (3000)        │ { port: 3000, env: 'development', isProduction: false }│
 * │ Normal 2  │ resolveAppConfig(5000)              │ argv: ['node', 'app.mjs'], env: {}, defaultPort: 5000                  │ { port: 5000, env: 'development', isProduction: false }│
 * │ Normal 3  │ resolveAppConfig(3000)              │ argv: ['node', 'app.mjs', '--port', '6000'], env: { NODE_ENV: 'prod' }│ { port: 6000, env: 'production', isProduction: true }  │
 * │ Edge 1    │ resolveAppConfig(5000)              │ argv: ['node', 'app.mjs'], env: { PORT: '8080' }, defaultPort: 5000    │ { port: 8080, env: 'development', isProduction: false }│
 * │ Edge 2    │ resolveAppConfig(3000)              │ argv: ['node', 'app', '--port', '4200'], env: { PORT: '8080' }         │ { port: 4200, env: 'development', isProduction: false }│
 * │ Error 1   │ resolveAppConfig('not-a-number')    │ defaultPort: 'not-a-number'                                            │ Lempar Error('Invalid port number')                    │
 * │ Error 2   │ resolveAppConfig(99999)             │ defaultPort: 99999                                                     │ Lempar Error('Invalid port number')                    │
 * │ Error 3   │ resolveAppConfig(0)                 │ defaultPort: 0                                                         │ Lempar Error('Invalid port number')                    │
 * └───────────┴─────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘
 */

/**
 * Menyelesaikan konfigurasi port dan mode environment dari CLI argument dan process.env.
 *
 * @param {number} [defaultPort=3000]
 * @returns {{ port: number, env: string, isProduction: boolean }}
 */
export function resolveAppConfig(defaultPort = 3000) {
  const args = process.argv.slice(2);
  const indexPort = args.indexOf('--port');
  const cliPort = indexPort !== -1 ? args[indexPort + 1] : undefined;

  const port = Number(cliPort ?? process.env.PORT ?? defaultPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  return {
    port,
    env,
    isProduction,
  };
}
