import http from 'node:http';

/**
 * ============================================================================
 * SOAL 03: Mini HTTP Dispatcher & Router
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Bangun class `MiniHttpRouter` yang bertindak sebagai router HTTP modular untuk
 *    mendaftarkan rute (method, path, handler) dengan validasi metode HTTP resmi
 *    Node.js (`http.METHODS`), men-dispatch incoming request (`req`, `res`),
 *    menangani respons otomatis 404 (Not Found) dan 405 (Method Not Allowed
 *    dengan header Allow), serta memasang error boundary status 500 (Internal Server Error)
 *    menggunakan `http.STATUS_CODES`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:http`: `http.METHODS`, `http.STATUS_CODES`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Method `register(method, path, handler)`:
 *       - Parameter `method`: Wajib berupa string. Konversikan ke huruf besar (`toUpperCase()`).
 *         Validasi apakah nilai tersebut terdaftar di `http.METHODS`.
 *         Jika bukan string atau tidak valid di `http.METHODS`, lempar `TypeError` dengan pesan persis:
 *         "Invalid HTTP method"
 *       - Parameter `path`: Wajib berupa string dan diawali dengan `'/'`.
 *         Jika bukan string atau tidak diawali `'/'`, lempar `TypeError` dengan pesan persis:
 *         "Path must be a string starting with /"
 *       - Parameter `handler`: Wajib bertipe function (`typeof handler === 'function'`).
 *         Jika bukan function, lempar `TypeError` dengan pesan persis:
 *         "Handler must be a function"
 *       - Normalisasi path pada pendaftaran: Hapus trailing slash jika panjangnya > 1 (contoh: `'/users/'` menjadi `'/users'`),
 *         tetapi biarkan root path `'/'` apa adanya.
 *       - Kembalikan instance router (`this`) untuk mendukung method chaining.
 *    2. Method `handle(req, res)`:
 *       - Parameter `req`: Wajib object dengan properti `method` (string) dan `url` (string).
 *         Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *         "Invalid request object"
 *       - Parameter `res`: Wajib object dengan method `setHeader`, `writeHead`, dan `end`.
 *         Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *         "Invalid response object"
 *       - Normalisasi URL request:
 *         * Ekstraksi pathname murni tanpa query string (misal `'/users?page=1'` menjadi `'/users'`).
 *         * Normalisasi trailing slash (misal `'/users/'` menjadi `'/users'`), kecuali root path `'/'`.
 *       - Normalisasi method request: Ubah `req.method` menjadi uppercase.
 *       - Alur Dispatch:
 *         a. **Match**: Jika method dan path cocok dengan rute terdaftar:
 *            Eksekusi `await handler(req, res)`.
 *         b. **Method Not Allowed (405)**: Jika path cocok tetapi method tidak terdaftar:
 *            - Kumpulkan seluruh method yang terdaftar pada path tersebut, urutkan secara alfabetis (ascending),
 *              lalu tetapkan header `'Allow'` dengan format string dipisahkan koma dan spasi (misal `'GET, POST'`).
 *            - Set header `'Content-Type': 'text/plain'`.
 *            - Kirim status `405` dan body `http.STATUS_CODES[405]` via `res.writeHead(405)` dan `res.end(http.STATUS_CODES[405])`.
 *         c. **Not Found (404)**: Jika path tidak terdaftar pada method mana pun:
 *            - Set header `'Content-Type': 'text/plain'`.
 *            - Kirim status `404` dan body `http.STATUS_CODES[404]` via `res.writeHead(404)` dan `res.end(http.STATUS_CODES[404])`.
 *         d. **Error Boundary (500)**:
 *            - Jika pemanggilan handler melempar exception atau Promise-nya reject:
 *              Periksa `res.headersSent`. Jika belum terkirim (`!res.headersSent`),
 *              set header `'Content-Type': 'text/plain'`, kirim status `500` dan body `http.STATUS_CODES[500]`.
 *    3. Method `getRoutes()`:
 *       - Mengembalikan array daftar rute terdaftar dengan elemen `{ method, path }`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                              │ Input                                                  │ Expected                                                       │
 * ├───────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ router.handle(req, res)                  │ req: GET '/health', route GET '/health' registered     │ Handler dipanggil, res status 200                              │
 * │ Normal 2  │ router.handle(req, res)                  │ req: POST '/items', route POST '/items' registered     │ Handler dipanggil, res status 201                              │
 * │ Normal 3  │ router.register(...).register(...)       │ Method chaining dua registrasi rute                    │ Mengembalikan instance router dan kedua rute tersimpan         │
 * │ Edge 1    │ router.handle(req, res)                  │ req: GET '/users?role=admin' (query string)            │ Cocok dengan route '/users'                                    │
 * │ Edge 2    │ router.handle(req, res)                  │ req: GET '/users/' (trailing slash)                    │ Cocok dengan route '/users'                                    │
 * │ Edge 3    │ router.handle(req, res)                  │ req: get '/health' (lowercase method)                  │ Handler GET '/health' terpanggil                               │
 * │ Edge 4    │ router.handle(req, res)                  │ req: GET '/nonexistent'                                │ Status 404, body: 'Not Found'                                  │
 * │ Edge 5    │ router.handle(req, res)                  │ req: DELETE '/health' (GET '/health' registered)       │ Status 405, Allow: 'GET', body: 'Method Not Allowed'           │
 * │ Edge 6    │ router.handle(req, res)                  │ req: GET '/fail' (handler throws Error)                │ Status 500, body: 'Internal Server Error'                      │
 * │ Error 1   │ router.register('INVALID_METHOD', ...)   │ method: 'INVALID_METHOD'                               │ TypeError: "Invalid HTTP method"                               │
 * │ Error 2   │ router.register('GET', 'no-slash', ...)  │ path: 'no-slash'                                       │ TypeError: "Path must be a string starting with /"             │
 * │ Error 3   │ router.register('GET', '/ok', 'not-fn')  │ handler: 'not-fn'                                      │ TypeError: "Handler must be a function"                        │
 * │ Error 4   │ router.handle(null, res)                 │ req: null                                              │ TypeError: "Invalid request object"                            │
 * │ Error 5   │ router.handle(req, null)                 │ res: null                                              │ TypeError: "Invalid response object"                           │
 * └───────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────┘
 */

// Helper validasi metode HTTP resmi Node.js (menggunakan array http.METHODS)
const isStringMethod = (v) =>
  typeof v === 'string' && http.METHODS.includes(v.toUpperCase());

// Helper validasi path rute (wajib diawali '/')
const isPath = (v) => typeof v === 'string' && v.startsWith('/');

// Helper validasi fungsi handler
const isHandler = (v) => typeof v === 'function';

// Normalisasi trailing slash: '/users/' -> '/users', tetapi '/' tetap '/'
const normalizePath = (path) => {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
};

// Helper validasi objek incoming request
const isReq = (v) =>
  v !== null &&
  typeof v === 'object' &&
  typeof v.method === 'string' &&
  typeof v.url === 'string';

// Helper validasi objek server response
const isRes = (v) =>
  v !== null &&
  typeof v === 'object' &&
  typeof v.setHeader === 'function' &&
  typeof v.writeHead === 'function' &&
  typeof v.end === 'function';

export class MiniHttpRouter {
  constructor() {
    // Inisialisasi wadah penampung rute terdaftar
    this.routes = [];
  }

  /**
   * Registers a route handler for a given HTTP method and path.
   *
   * @param {string} method
   * @param {string} path
   * @param {Function} handler
   * @returns {MiniHttpRouter}
   */
  register(method, path, handler) {
    // 1. Validasi method HTTP terhadap kamus http.METHODS
    if (!isStringMethod(method)) {
      throw new TypeError('Invalid HTTP method');
    }

    // 2. Validasi format path rute
    if (!isPath(path)) {
      throw new TypeError('Path must be a string starting with /');
    }

    // 3. Validasi tipe handler (wajib fungsi)
    if (!isHandler(handler)) {
      throw new TypeError('Handler must be a function');
    }

    // 4. Normalisasi path dan simpan ke koleksi rute
    const normalizedPath = normalizePath(path);
    this.routes.push({
      method: method.toUpperCase(),
      path: normalizedPath,
      handler,
    });

    // 5. Kembalikan instance router saat ini untuk mendukung method chaining
    return this;
  }

  /**
   * Dispatches incoming request to registered route handler.
   *
   * @param {object} req
   * @param {object} res
   * @returns {Promise<void>}
   */
  async handle(req, res) {
    // 1. Validasi defensif objek request dan response
    if (!isReq(req)) {
      throw new TypeError('Invalid request object');
    }
    if (!isRes(res)) {
      throw new TypeError('Invalid response object');
    }

    // 2. Normalisasi method dan parsing pathname dari URL request
    const requestMethod = req.method.toUpperCase();
    const parsedUrl = new URL(req.url, 'http://localhost');
    const requestPath = normalizePath(parsedUrl.pathname);

    // 3. Cari rute yang cocok sempurna (Method dan Path sama)
    const matchedRoute = this.routes.find(
      (r) => r.method === requestMethod && r.path === requestPath,
    );

    if (matchedRoute) {
      try {
        // Normal: eksekusi handler yang terdaftar
        await matchedRoute.handler(req, res);
      } catch {
        // Edge-case: error boundary jika handler melempar exception (status 500)
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'text/plain');
          res.writeHead(500);
          res.end(http.STATUS_CODES[500]);
        }
      }
      return;
    }

    // 4. Kasus 405 (Method Not Allowed): Path terdaftar namun method tidak cocok
    const samePathRoutes = this.routes.filter((r) => r.path === requestPath);
    if (samePathRoutes.length > 0) {
      const allowedMethods = samePathRoutes
        .map((r) => r.method)
        .sort()
        .join(', ');

      res.setHeader('Allow', allowedMethods);
      res.setHeader('Content-Type', 'text/plain');
      res.writeHead(405);
      res.end(http.STATUS_CODES[405]);
      return;
    }

    // 5. Kasus 404 (Not Found): Path tidak terdaftar pada method mana pun
    res.setHeader('Content-Type', 'text/plain');
    res.writeHead(404);
    res.end(http.STATUS_CODES[404]);
    return;
  }

  /**
   * Returns registered routes list.
   *
   * @returns {Array<{ method: string, path: string }>}
   */
  getRoutes() {
    // Kembalikan salinan array tanpa menyertakan referensi fungsi handler
    return this.routes.map(({ method, path }) => ({ method, path }));
  }
}
