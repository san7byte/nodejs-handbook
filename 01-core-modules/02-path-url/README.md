# Path & URL

> Modul `node:path` dan `node:url` menangani resolusi path sistem berkas lintas sistem operasi serta parsing URL dan manipulasi query string berbasis standar WHATWG.

## Kenapa Perlu?

Format path sistem berkas berbeda antar sistem operasi, misalnya separator backslash (`\`) di Windows dan forward slash (`/`) di POSIX. Penggabungan string secara manual menyebabkan bug crash lintas platform serta membuka celah keamanan serius seperti _path traversal attack_. Di sisi jaringan, manipulasi URL dan query string mentah berisiko merusak karakter khusus dan spasi jika tidak di-encode sesuai standar resmi WHATWG.

## Konsep Inti

- Jangan pernah menyambung path dengan konkatenasi string manual (`'a' + '/' + 'b'`), selalu gunakan `path.join()`.
- `path.resolve()` menghasilkan path absolut dari kanan ke kiri, sedangkan `path.relative()` menghitung navigasi relatif antar-dua path.
- Gunakan trinitas `path.dirname()`, `path.basename()`, dan `path.extname()`, atau `path.parse()` dan `path.format()` untuk transformasi dua arah path berkas.
- Class `URL` dan `URLSearchParams` mengikuti standar resmi WHATWG yang konsisten antara Node.js dan browser modern.
- Gunakan `URL.canParse()` untuk validasi URL secara defensif tanpa memicu runtime exception.
- Gunakan `pathToFileURL()` dan `fileURLToPath()` untuk konversi aman antara path sistem berkas dan URL `file:` tanpa merusak karakter khusus.

## Langkah 1: Menggabungkan dan Menormalkan Path

Kita menggabungkan beberapa potongan direktori menjadi satu path utuh yang aman lintas platform dan menormalkan segmen yang berulang.

Buat file `path-join.mjs`.

```js
import path from "node:path";

// Normal: join segments safely cross-platform
const joined = path.join("uploads", "users", "avatar.png");

// Edge-case: redundant separators and directory traversal segments
const normalized = path.normalize("/app//routes/../config/./db.json");
const emptyJoined = path.join("data", "", "archive.zip");

console.log("Joined:", joined);
console.log("Normalized:", normalized);
console.log("Empty segment handled:", emptyJoined);
```

Jalankan file:

```bash
node path-join.mjs
```

Output:

```
Joined: uploads/users/avatar.png
Normalized: /app/config/db.json
Empty segment handled: data/archive.zip
```

Method `path.join()` menyambungkan setiap segmen menggunakan pemisah bawaan OS aktif (`/` di POSIX atau `\` di Windows). Method `path.normalize()` membersihkan separator ganda dan menyelesaikan referensi direktori relatif seperti `.` dan `..`.

## Langkah 2: Menghasilkan Path Absolut dan Relatif

Kita mengubah path relatif menjadi path absolut berbasis direktori kerja aktif, menghitung navigasi path relatif antar-dua lokasi, dan menangani kondisi batas saat segmen absolut muncul di tengah parameter.

Buat file `path-resolve.mjs`.

```js
import path from "node:path";

// Normal: resolve relative path to absolute based on process.cwd()
const absPath = path.resolve("data", "reports.csv");

// Normal: calculate relative path between two directories
const relPath = path.relative("/app/src/controllers", "/app/src/models/user.js");

// Edge-case: encountering an absolute path resets preceding segments
const overridden = path.resolve("var", "log", "/etc", "nginx.conf");
const emptyResolve = path.resolve();

// Edge-case: identical paths produce an empty string
const sameRel = path.relative("/app/data", "/app/data");

console.log("Is absolute:", path.isAbsolute(absPath));
console.log("Relative path:", relPath);
console.log("Overridden absolute:", overridden);
console.log("Empty resolve is cwd:", emptyResolve === process.cwd());
console.log("Same path relative is empty:", sameRel === "");
```

Jalankan file:

```bash
node path-resolve.mjs
```

Output:

```
Is absolute: true
Relative path: ../models/user.js
Overridden absolute: /etc/nginx.conf
Empty resolve is cwd: true
Same path relative is empty: true
```

Method `path.resolve()` membaca argumen dari kanan ke kiri hingga menemukan path absolut (mengabaikan segmen sebelumnya jika segmen baru diawali slash absolut `/etc`). Method `path.relative()` menghitung path navigasi relatif dari direktori asal ke tujuan, serta menghasilkan string kosong jika kedua path merujuk ke lokasi yang sama.

## Langkah 3: Mengurai dan Menyusun Komponen Path Berkas

Kita membedah string path menjadi objek terstruktur menggunakan `path.parse()`, menyusunnya kembali dengan `path.format()`, serta mengekstrak komponen spesifik dengan fungsi trinitas path.

Buat file `path-parse.mjs`.

```js
import path from "node:path";

const fullFile = "/var/www/uploads/document.pdf";

// Normal: decompose path elements using utility functions
const dir = path.dirname(fullFile);
const base = path.basename(fullFile);
const ext = path.extname(fullFile);
const baseWithoutExt = path.basename(fullFile, ext);

// Normal: parse path into a structured object
const parsed = path.parse(fullFile);

// Normal: format an object back into a path string
const formatted = path.format({
  dir: "/app/dist",
  name: "bundle",
  ext: ".js",
});

// Edge-case: dotfiles and files without extension
const dotfile = "/app/.env";
const dotfileExt = path.extname(dotfile);
const dotfileBase = path.basename(dotfile);

// Edge-case: base property in format overrides name and ext
const formattedWithBase = path.format({
  dir: "/app/dist",
  base: "custom.min.js",
  name: "ignored",
  ext: ".ts",
});

console.log("Dirname:", dir);
console.log("Basename without ext:", baseWithoutExt);
console.log("Extname:", ext);
console.log("Parsed base:", parsed.base);
console.log("Parsed name:", parsed.name);
console.log("Formatted:", formatted);
console.log("Dotfile basename:", dotfileBase);
console.log("Dotfile extname is empty:", dotfileExt === "");
console.log("Base overrides name/ext:", formattedWithBase);
```

Jalankan file:

```bash
node path-parse.mjs
```

Output:

```
Dirname: /var/www/uploads
Basename without ext: document
Extname: .pdf
Parsed base: document.pdf
Parsed name: document
Formatted: /app/dist/bundle.js
Dotfile basename: .env
Dotfile extname is empty: true
Base overrides name/ext: /app/dist/custom.min.js
```

Fungsi trinitas `path.dirname()`, `path.basename()`, dan `path.extname()` mengekstrak potongan string individual. Method `path.parse()` memecah path langsung menjadi objek komponen (`root`, `dir`, `base`, `ext`, `name`), sedangkan `path.format()` merekonstruksi objek tersebut menjadi string (di mana properti `base` akan mengesampingkan `name` dan `ext` jika keduanya diisi).

## Langkah 4: Parsing dan Validasi URL WHATWG

Kita membedah string URL menjadi objek WHATWG terstruktur dan memvalidasi keabsahan format URL secara defensif.

Buat file `url-parse.mjs`.

```js
import { URL } from "node:url";

// Normal: parse absolute URL and relative with base
const api = new URL("/v1/users", "https://api.example.com:8080");

// Edge-case: defensive validation without try-catch using URL.canParse
const isValid = URL.canParse("https://api.example.com/health");
const isInvalid = URL.canParse("/invalid-without-base");

console.log("Origin:", api.origin);
console.log("Pathname:", api.pathname);
console.log("Valid URL check:", isValid);
console.log("Invalid URL check:", isInvalid);
```

Jalankan file:

```bash
node url-parse.mjs
```

Output:

```
Origin: https://api.example.com:8080
Pathname: /v1/users
Valid URL check: true
Invalid URL check: false
```

Objek `URL` memisahkan komponen `origin`, `hostname`, `port`, dan `pathname` secara otomatis. Method statis `URL.canParse()` (tersedia di Node.js v19.9+) mengembalikan boolean `false` jika string tidak dapat di-parse, sehingga kita tidak perlu membungkus validasi input URL pengguna di dalam blok `try...catch`.

## Langkah 5: Mengelola Query String

Kita memanipulasi parameter query string URL dan menangani karakter khusus yang membutuhkan encoding.

Buat file `url-search-params.mjs`.

```js
import { URLSearchParams } from "node:url";

// Normal: build and manipulate query parameters
const params = new URLSearchParams("sort=asc&page=1");
params.set("page", "2");
params.append("filter", "active");
params.append("filter", "verified");

// Edge-case: special characters encoding and parsing leading '?'
const rawQuery = new URLSearchParams("?tag=node%2Bjs&q=c%2B%2B");

console.log("Page:", params.get("page"));
console.log("Filters:", params.getAll("filter"));
console.log("Serialized:", params.toString());
console.log("Decoded tag:", rawQuery.get("tag"));
console.log("Decoded q:", rawQuery.get("q"));
```

Jalankan file:

```bash
node url-search-params.mjs
```

Output:

```
Page: 2
Filters: [ 'active', 'verified' ]
Serialized: sort=asc&page=2&filter=active&filter=verified
Decoded tag: node+js
Decoded q: c++
```

Objek `URLSearchParams` menyediakan method `.set()` untuk mengganti nilai dan `.append()` untuk menambahkan multiple value pada key yang sama. Konstruktor ini secara otomatis mengabaikan tanda tanya (`?`) di awal query string dan menangani _percent-encoding_ seperti karakter `+` (`%2B`) secara transparan.

## Langkah 6: Konversi Path Berkas dan URL Protokol file:

Kita mengonversi path sistem berkas absolut menjadi WHATWG URL berprotokol `file:` dan sebaliknya secara aman.

Buat file `url-path-conv.mjs`.

```js
import { fileURLToPath, pathToFileURL } from "node:url";

const localPath = "/app/data/file#1 [v2].json";

// Normal: convert file path to file:// WHATWG URL and back
const fileUrl = pathToFileURL(localPath);
const restoredPath = fileURLToPath(fileUrl);

// Edge-case: special characters (#, spaces, brackets) safely percent-encoded
console.log("URL protocol:", fileUrl.protocol);
console.log("URL encoded href contains %23:", fileUrl.href.includes("%23"));
console.log("Restored matches original:", restoredPath === localPath);
```

Jalankan file:

```bash
node url-path-conv.mjs
```

Output:

```
URL protocol: file:
URL encoded href contains %23: true
Restored matches original: true
```

Menggabungkan string manual seperti `'file://' + localPath` akan gagal jika path mengandung karakter tanda pagar (`#`) atau tanda persen (`%`) karena URL menganggapnya sebagai _fragment identifier_. Fungsi `pathToFileURL()` meng-encode karakter tersebut menjadi `%23`, dan `fileURLToPath()` mengembalikannya ke bentuk path lokal sistem berkas tanpa kehilangan karakter.

## Referensi API

| API                            | Fungsi                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path.join(...paths)`          | Menggabungkan potongan segmen path dengan separator platform aktif. `paths` (string, wajib, banyak). Returns `string`.                           |
| `path.resolve(...paths)`       | Menyelesaikan urutan path menjadi path absolut berbasis direktori kerja. `paths` (string, wajib, banyak). Returns `string`.                      |
| `path.normalize(path)`         | Membersihkan duplikasi separator dan menyelesaikan segmen relatif `.` atau `..`. `path` (string, wajib). Returns `string`.                       |
| `path.relative(from, to)`      | Menghitung path relatif dari direktori `from` ke `to`. `from` (string, wajib), `to` (string, wajib). Returns `string`.                            |
| `path.dirname(path)`           | Mengambil path direktori induk dari suatu path berkas. `path` (string, wajib). Returns `string`.                                                 |
| `path.basename(path, suffix?)` | Mengambil nama berkas terakhir dari path dengan opsi pemotongan ekstensi. `path` (string, wajib), `suffix` (string, opsional). Returns `string`. |
| `path.extname(path)`           | Mengambil ekstensi berkas mulai dari tanda titik terakhir. `path` (string, wajib). Returns `string`.                                             |
| `path.parse(path)`             | Mengurai string path menjadi objek komponen (`root`, `dir`, `base`, `ext`, `name`). `path` (string, wajib). Returns `object`.                   |
| `path.format(pathObject)`      | Menyusun string path utuh dari objek komponen path. `pathObject` (object, wajib). Returns `string`.                                               |
| `new URL(input, base?)`        | Melakukan parsing URL string menjadi objek WHATWG URL terstruktur. `input` (string, wajib), `base` (string \| URL, opsional). Returns `URL`.     |
| `URL.canParse(input, base?)`   | Memvalidasi kelayakan parsing string URL tanpa melempar exception. `input` (string, wajib), `base` (string \| URL, opsional). Returns `boolean`. |
| `new URLSearchParams(init?)`   | Mengelola parameter query string URL. `init` (string \| object \| Iterable, opsional). Returns `URLSearchParams`.                                |
| `fileURLToPath(url)`           | Mengonversi objek atau string URL `file:` menjadi string path sistem berkas absolut. `url` (string \| URL, wajib). Returns `string`.             |
| `pathToFileURL(path)`          | Mengonversi string path berkas absolut menjadi instance WHATWG URL berprotokol `file:`. `path` (string, wajib). Returns `URL`.                   |

## Kasus di Aplikasi

Di backend, sanitasi path berkas wajib diterapkan pada endpoint unduhan atau penyajian berkas statis (seperti gambar avatar pengguna) untuk mencegah serangan _path traversal_.

**Masalah:** Klien mengirim input berbahaya seperti `../../etc/passwd` atau `../secret.key` untuk membaca berkas rahasia di luar direktori publik yang diizinkan.

**Solusi:** Selesaikan path ke bentuk absolut dengan `path.resolve()`, lalu pastikan bahwa path target diawali dengan direktori publik yang diakhiri pemisah direktori `path.sep`.

```js
import path from "node:path";

const PUBLIC_DIR = path.resolve("public");

function getSafePath(baseDir, userInput) {
  const resolvedBase = path.resolve(baseDir);
  const target = path.resolve(resolvedBase, userInput);

  // Enforce boundary by checking prefix with directory separator
  if (!target.startsWith(resolvedBase + path.sep)) {
    throw new Error("Access denied: Path traversal detected");
  }

  return target;
}

try {
  const safe = getSafePath(PUBLIC_DIR, "images/avatar.png");
  console.log("Safe path valid:", safe.endsWith("public/images/avatar.png"));

  getSafePath(PUBLIC_DIR, "../../etc/passwd");
} catch (err) {
  console.log("Security check blocked:", err.message);
}
```

## Pitfalls

- Menggabungkan path dengan konkatenasi string manual `'uploads/' + filename`.
  Separator akan rusak di Windows yang menggunakan backslash (`\`); selalu gunakan `path.join()`.

  ```js
  // ❌ Incorrect: fails across platforms due to backslash vs slash
  const filePath = "uploads/" + filename;

  // ✅ Correct: cross-platform safe
  const filePath = path.join("uploads", filename);
  ```

- Validasi path traversal tanpa menyertakan `path.sep` di akhir base directory.
  Attacker dapat mengakses folder saudara (_sibling directory_) yang memiliki awalan nama serupa seperti `public-secret`.

  ```js
  // ❌ Incorrect: allows sibling escape (e.g. /public-secret startsWith /public)
  if (!target.startsWith(baseDir)) throw new Error("Forbidden");

  // ✅ Correct: strictly enforces directory boundary
  if (!target.startsWith(baseDir + path.sep)) throw new Error("Forbidden");
  ```

- Merangkai query string manual `'?search=' + input` tanpa `URLSearchParams`.
  Karakter khusus seperti spasi atau tanda plus (`+`) akan rusak dan tidak ter-encode dengan benar.

  ```js
  // ❌ Incorrect: '+' turns into space, corrupting query values
  const query = "?search=" + "c++ developer";

  // ✅ Correct: auto percent-encodes special characters safely
  const params = new URLSearchParams();
  params.set("search", "c++ developer");
  const query = "?" + params.toString();
  ```

- Mengonversi path berkas ke URL dengan perangkaian string manual `'file://' + path`.
  Karakter tanda pagar (`#`) akan terpotong menjadi URL fragment dan karakter khusus lainnya tidak ter-encode.

  ```js
  // ❌ Incorrect: naive string concat breaks on special characters (# and %)
  const fileUrl = new URL("file://" + absolutePath);

  // ✅ Correct: automatically encodes file paths into safe WHATWG file: URLs
  const fileUrl = pathToFileURL(absolutePath);
  ```

## Referensi

- [Node.js Docs: Path](https://nodejs.org/api/path.html)
- [Node.js Docs: URL](https://nodejs.org/api/url.html)
- [WHATWG URL Standard](https://url.spec.whatwg.org/)

---

Berikutnya: [03 - File System](../03-fs/README.md)
