import path from 'node:path';

const fullFile = '/var/www/uploads/document.pdf';

// Normal: decompose path elements using utility functions
const dir = path.dirname(fullFile);
const base = path.basename(fullFile);
const ext = path.extname(fullFile);
const baseWithoutExt = path.basename(fullFile, ext);

// Normal: parse path into a structured object
const parsed = path.parse(fullFile);

// Normal: format an object back into a path string
const formatted = path.format({
  dir: '/app/dist',
  name: 'bundle',
  ext: '.js',
});

// Edge-case: dotfiles and files without extension
const dotfile = '/app/.env';
const dotfileExt = path.extname(dotfile);
const dotfileBase = path.basename(dotfile);

// Edge-case: base property in format overrides name and ext
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
