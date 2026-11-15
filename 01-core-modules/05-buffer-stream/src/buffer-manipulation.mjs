import { Buffer } from 'node:buffer';

// Normal: menggabungkan beberapa buffer menjadi satu buffer kontigu dengan Buffer.concat
const part1 = Buffer.from('Node.js ');
const part2 = Buffer.from('Streams ');
const part3 = Buffer.from('Rock!');
const combined = Buffer.concat([part1, part2, part3]);
console.log('Combined text:', combined.toString('utf8'));
console.log('Combined length:', combined.length);

// Normal: menyalin byte secara eksplisit ke dalam buffer target yang sudah dialokasikan
const target = Buffer.alloc(4);
// part1.copy(target, targetStart, sourceStart, sourceEnd)
part1.copy(target, 0, 0, 4); // Salin 4 byte pertama ('Node') ke target
console.log('Target buffer text:', target.toString('utf8'));

// Normal: memeriksa kesetaraan isi biner dua buffer dengan buffer.equals
const clonePart1 = Buffer.from('Node.js ');
console.log('part1 equals clonePart1:', part1.equals(clonePart1));
console.log('part1 equals part2:', part1.equals(part2));

// Normal: mencari posisi indeks byte atau substring dalam buffer
const indexStream = combined.indexOf('Streams');
console.log("Index of 'Streams':", indexStream);

// Edge-case: indexOf mengembalikan -1 jika token yang dicari tidak ditemukan
console.log("Index of 'Python':", combined.indexOf('Python'));

// Edge-case: Buffer.concat dengan array kosong menghasilkan buffer berukuran 0
const emptyConcat = Buffer.concat([]);
console.log('Empty concat length:', emptyConcat.length);

// Edge-case: Buffer.concat dengan totalLength memotong data secara aman jika panjangnya dibatasi
const truncatedConcat = Buffer.concat([part1, part2], 4);
console.log('Truncated concat text:', truncatedConcat.toString('utf8'));
