import path from 'node:path';

// Normal: menyelesaikan path relatif menjadi path absolut berdasarkan process.cwd()
const absPath = path.resolve('data', 'reports.csv');

// Normal: menghitung navigasi path relatif di antara dua direktori
const relPath = path.relative('/app/src/controllers', '/app/src/models/user.js');

// Edge-case: segmen path absolut mereset seluruh segmen sebelumnya
const overridden = path.resolve('var', 'log', '/etc', 'nginx.conf');
const emptyResolve = path.resolve();

// Edge-case: dua path identik menghasilkan string kosong
const sameRel = path.relative('/app/data', '/app/data');

console.log('Is absolute:', path.isAbsolute(absPath));
console.log('Relative path:', relPath);
console.log('Overridden absolute:', overridden);
console.log('Empty resolve is cwd:', emptyResolve === process.cwd());
console.log('Same path relative is empty:', sameRel === '');
