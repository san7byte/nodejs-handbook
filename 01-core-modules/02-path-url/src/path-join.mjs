import path from 'node:path';

// Normal: join segments safely cross-platform
const joined = path.join('uploads', 'users', 'avatar.png');

// Edge-case: redundant separators and directory traversal segments
const normalized = path.normalize('/app//routes/../config/./db.json');
const emptyJoined = path.join('data', '', 'archive.zip');

console.log('Joined:', joined);
console.log('Normalized:', normalized);
console.log('Empty segment handled:', emptyJoined);

// NOTE: jika pakai path.join() maka '..' akan dihitung sebagai naik satu tingkat direktori
