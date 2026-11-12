import fs from 'node:fs/promises';
import { constants } from 'node:fs';

const srcFile = new URL('source.txt', import.meta.url);
const copyTarget = new URL('target.txt', import.meta.url);
const renamedFile = new URL('renamed.txt', import.meta.url);
const testDir = new URL('temp-cleanup-tree', import.meta.url);

await fs.writeFile(srcFile, 'Payload to copy', 'utf8');

// Normal: salin, ubah nama, dan hapus berkas tunggal
await fs.copyFile(srcFile, copyTarget);
await fs.rename(copyTarget, renamedFile);
await fs.unlink(renamedFile);
console.log('Copy, rename, and unlink completed.');

// Edge-case: flag COPYFILE_EXCL mencegah penimpaan berkas target yang sudah ada
await fs.writeFile(copyTarget, 'Existing file', 'utf8');
try {
  await fs.copyFile(srcFile, copyTarget, constants.COPYFILE_EXCL);
} catch (err) {
  console.log('Caught copy destination exists code:', err.code);
}

// // Edge-case: rm dengan force: true mengabaikan error jika target tidak ditemukan
await fs.mkdir(testDir, { recursive: true });
await fs.rm(testDir, { recursive: true, force: true });
await fs.rm('non-existent-folder', { recursive: true, force: true });
console.log('Force removal completed without error.');

// // Cleanup: hapus berkas uji
await fs.unlink(srcFile);
await fs.unlink(copyTarget);
