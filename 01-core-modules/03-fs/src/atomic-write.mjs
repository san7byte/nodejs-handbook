import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export async function safeSave(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tempPath = path.join(dir, `.tmp-${crypto.randomUUID()}`);
  const payload = JSON.stringify(data, null, 2);

  // Tulis ke berkas sementara terlebih dahulu
  await fs.writeFile(tempPath, payload, 'utf8');

  // Ganti berkas target secara atomik dalam satu syscall di filesystem yang sama
  await fs.rename(tempPath, filePath);
}

const target = path.resolve('config.json');

try {
  await safeSave(target, { server: 'primary', port: 8080, active: true });
  const raw = await fs.readFile(target, 'utf8');
  const parsed = JSON.parse(raw);
  console.log('Saved server:', parsed.server);
  console.log('Saved port:', parsed.port);
} finally {
  await fs.unlink(target).catch(() => {});
}
