import fs from 'node:fs/promises';
import { URL } from 'node:url';

const filePath = 'note.txt';
const targetUrl = new URL(filePath, import.meta.url);

// Normal: tulis data dan baca kembali sebagai string utf-8
await fs.writeFile(targetUrl, 'Initial note content.\n', 'utf8');
await fs.appendFile(targetUrl, 'Appended log entry.\n', 'utf8');

const content = await fs.readFile(targetUrl, 'utf8');
console.log('File content:\n' + content.trim());

// Edge-case: tangani berkas yang tidak ada (ENOENT) dan proteksi overwrite (flag 'wx')
try {
  await fs.readFile('non-existent.txt', 'utf8');
} catch (err) {
  console.log('Caught missing file code:', err.code);
}

try {
  // Flag 'wx' gagal melempar EEXIST jika berkas sudah ada sebelumnya
  await fs.writeFile(targetUrl, 'Should fail', { flag: 'wx' });
} catch (err) {
  console.log('Caught overwrite prevention code:', err.code);
}

// Cleanup: hapus berkas uji (komentari baris ini jika ingin melihat file di disk)
await fs.unlink(targetUrl);
