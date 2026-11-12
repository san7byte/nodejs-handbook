import path from 'node:path';

const fullFile = '/var/www/uploads/document.pdf';

// Normal: membedah elemen path menggunakan fungsi pembantu
const dir = path.dirname(fullFile);
const base = path.basename(fullFile);
const ext = path.extname(fullFile);
const baseWithoutExt = path.basename(fullFile, ext);

// Normal: membedah path menjadi objek terstruktur
const parsed = path.parse(fullFile);

// Normal: menyusun kembali objek menjadi string path
const formatted = path.format({
  dir: '/app/dist',
  name: 'bundle',
  ext: '.js',
});

// Edge-case: dotfile dan berkas tanpa ekstensi
const dotfile = '/app/.env';
const dotfileExt = path.extname(dotfile);
const dotfileBase = path.basename(dotfile);

// Edge-case: properti base pada format menimpa properti name dan ext
const formattedWithBase = path.format({
  dir: '/app/dist',
  base: 'custom.min.js',
  name: 'ignored',
  ext: '.ts',
});

console.log('Dirname:', dir);
console.log('Basename without ext:', baseWithoutExt);
console.log('Extname:', ext);
console.log('Parsed base:', parsed.base);
console.log('Parsed name:', parsed.name);
console.log('Formatted:', formatted);
console.log('Dotfile basename:', dotfileBase);
console.log('Dotfile extname is empty:', dotfileExt === '');
console.log('Base overrides name/ext:', formattedWithBase);
