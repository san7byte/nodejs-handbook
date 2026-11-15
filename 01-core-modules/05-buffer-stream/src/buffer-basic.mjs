import { Buffer } from 'node:buffer';

// Normal: membuat buffer dari string UTF-8 dan membandingkan byte length vs string length
const greeting = 'Halo Dunia ☕';
const bufGreeting = Buffer.from(greeting, 'utf8');
console.log('String length:', greeting.length);
console.log(
  'Byte length (Buffer.byteLength):',
  Buffer.byteLength(greeting, 'utf8'),
);
console.log('Buffer byte length (buf.length):', bufGreeting.length);

// Normal: alokasi memori bersih berisi nilai pengisi tetap dengan Buffer.alloc
const fixedBuf = Buffer.alloc(6, 'X', 'utf8');
console.log('Allocated buffer text:', fixedBuf.toString('utf8'));

// Normal: membuat slice memori tanpa alokasi baru (zero-copy) via subarray
const sub = bufGreeting.subarray(0, 4); // Mengambil potongan 'Halo'
console.log('Subarray text:', sub.toString('utf8'));

// Edge-case: mengubah data subarray langsung memutasi memori buffer asli
sub[0] = 74; // Kode ASCII untuk 'J'
console.log('Mutated original buffer text:', bufGreeting.toString('utf8'));

// Edge-case: validasi tipe data menggunakan Buffer.isBuffer
console.log('Is valid Buffer (bufGreeting):', Buffer.isBuffer(bufGreeting));
console.log(
  'Is plain Uint8Array a Buffer:',
  Buffer.isBuffer(new Uint8Array(4)),
);
console.log('Is string a Buffer:', Buffer.isBuffer('not a buffer'));

// Normal: konversi representasi biner ke Base64 dan pemulihan kembali
const base64Encoded = bufGreeting.toString('base64');
console.log('Base64 representation:', base64Encoded);
console.log(
  'Restored from Base64:',
  Buffer.from(base64Encoded, 'base64').toString('utf8'),
);
