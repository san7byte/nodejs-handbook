import { fileURLToPath, pathToFileURL } from 'node:url';

const localPath = '/app/data/file#1 [v2].json';

// Normal: mengonversi path lokal berkas ke WHATWG URL file:// dan sebaliknya
const fileUrl = pathToFileURL(localPath);
const restoredPath = fileURLToPath(fileUrl);

console.log(fileUrl.href); // 'file:///app/data/file%231%20%5Bv2%5D.json'
console.log(restoredPath); // Mengembalikan localPath awal

// Edge-case: karakter khusus (#, spasi, kurung siku) ter-encode secara aman
console.log('URL protocol:', fileUrl.protocol);
console.log('URL encoded href contains %23:', fileUrl.href.includes('%23'));
console.log('Restored matches original:', restoredPath === localPath);
