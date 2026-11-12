import path from 'node:path';

// Normal: menggabungkan segmen path secara aman lintas platform
const joined = path.join('uploads', 'users', 'avatar.png');

// Edge-case: separator ganda berlebih dan segmen navigasi direktori
const normalized = path.normalize('/app//routes/../config/./db.json');
const emptyJoined = path.join('data', '', 'archive.zip');

console.log('Joined:', joined);
console.log('Normalized:', normalized);
console.log('Empty segment handled:', emptyJoined);

// Note: jika pakai path.join() maka '..' akan dihitung sebagai naik satu tingkat direktori
