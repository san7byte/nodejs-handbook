import fs from 'node:fs/promises';

const dir = 'temp-project/subfolder';
await fs.mkdir(dir, { recursive: true });

await fs.writeFile('temp-project/file-a.txt', 'A');
await fs.writeFile('temp-project/subfolder/file-b.txt', 'B');

// Normal: membaca entri direktori beserta tipe berkasnya
const entries = await fs.readdir('temp-project', { withFileTypes: true });
for (const entry of entries) {
  console.log(`Entry: ${entry.name} (isDir: ${entry.isDirectory()})`);
}

// Edge-case: mkdir tanpa flag recursive pada path bersarang melempar ENOENT
try {
  await fs.mkdir('missing-root/deep/folder');
} catch (err) {
  console.log('Caught non-recursive mkdir code:', err.code);
}

// Edge-case: readdir pada direktori yang tidak ada melempar ENOENT
try {
  await fs.readdir('missing-dir');
} catch (err) {
  console.log('Caught missing dir code:', err.code);
}

// Cleanup: hapus direktori sementara beserta seluruh isinya
await fs.rm('temp-project', { recursive: true, force: true });
