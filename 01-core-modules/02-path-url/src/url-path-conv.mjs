import { fileURLToPath, pathToFileURL } from 'node:url';

const localPath = '/app/data/file#1 [v2].json';

// Normal: convert file path to file:// WHATWG URL and back
const fileUrl = pathToFileURL(localPath);
const restoredPath = fileURLToPath(fileUrl);

console.log(fileUrl.href); // 'file:///app/data/file%231%20%5Bv2%5D.json'
console.log(restoredPath); // restore localPath

// Edge-case: special characters (#, spaces, brackets) safely percent-encoded
console.log('URL protocol:', fileUrl.protocol);
console.log('URL encoded href contains %23:', fileUrl.href.includes('%23'));
console.log('Restored matches original:', restoredPath === localPath);
