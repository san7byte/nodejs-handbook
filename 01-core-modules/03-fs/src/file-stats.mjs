import fs from 'node:fs/promises';

const sampleFile = 'metadata-sample.txt';
await fs.writeFile(sampleFile, 'Standard buffer payload', 'utf8');

// Normal: memeriksa metadata berkas
const stats = await fs.stat(sampleFile);
console.log('Is file:', stats.isFile());
console.log('Is directory:', stats.isDirectory());
console.log('Byte size:', stats.size);
console.log('Valid mtime:', typeof stats.mtimeMs === 'number');

// Edge-case: verifikasi keberadaan berkas secara defensif lewat try-catch (pengganti aman fs.exists)
async function fileExists(targetPath) {
  try {
    await fs.stat(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

console.log('Sample exists:', await fileExists(sampleFile));
console.log('Missing exists:', await fileExists('non-existent.bin'));

// Cleanup: hapus berkas sampel
await fs.unlink(sampleFile);
