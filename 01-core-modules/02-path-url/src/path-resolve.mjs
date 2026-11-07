import path from 'node:path';

// Normal: resolve relative path to absolute based on process.cwd()
const absPath = path.resolve('data', 'reports.csv');

// Normal: calculate relative path between two directories
const relPath = path.relative('/app/src/controllers', '/app/src/models/user.js');

// Edge-case: encountering an absolute path resets preceding segments
const overridden = path.resolve('var', 'log', '/etc', 'nginx.conf');
const emptyResolve = path.resolve();

// Edge-case: identical paths produce an empty string
const sameRel = path.relative('/app/data', '/app/data');

console.log('Is absolute:', path.isAbsolute(absPath));
console.log('Relative path:', relPath);
console.log('Overridden absolute:', overridden);
console.log('Empty resolve is cwd:', emptyResolve === process.cwd());
console.log('Same path relative is empty:', sameRel === '');
