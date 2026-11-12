import fs from 'node:fs/promises';

const filePath = 'descriptor-sample.bin';
await fs.writeFile(filePath, 'HEADER_CONTENT_DATA', 'utf8');

// Normal: buka handle, baca sebagian buffer, dan tutup di blok finally
let handle;
try {
  handle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(6);
  const { bytesRead } = await handle.read(buffer, 0, 6, 0);
  console.log('Bytes read:', bytesRead);
  console.log('Header text:', buffer.toString('utf8'));
} finally {
  await handle?.close();
}

// Edge-case: membaca dari handle yang sudah ditutup melempar error EBADF
try {
  const dummyBuf = Buffer.alloc(4);
  await handle.read(dummyBuf, 0, 4, 0);
} catch (err) {
  console.log('Caught closed handle code:', err.code);
}

// Cleanup: hapus berkas sampel
await fs.unlink(filePath);
