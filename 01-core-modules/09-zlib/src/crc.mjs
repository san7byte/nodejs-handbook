import zlib from 'node:zlib';

// Normal: hitung checksum CRC32 dari buffer dan verifikasi integritas data
const originalData = Buffer.from('Database backup payload 2026');
const checksum = zlib.crc32(originalData);

// Kalkulasi checksum bertahap (incremental) pada aliran chunk
const chunk1 = Buffer.from('Database backup ');
const chunk2 = Buffer.from('payload 2026');
const incrementalChecksum = zlib.crc32(chunk2, zlib.crc32(chunk1));

console.log('Single-pass CRC32:', checksum);
console.log(
  'Incremental matches single-pass:',
  incrementalChecksum === checksum,
);

// Edge-case: deteksi modifikasi data melalui ketidakcocokan nilai checksum
const tamperedData = Buffer.from('Database backup payload 2027');
const tamperedChecksum = zlib.crc32(tamperedData);
const isIntact = tamperedChecksum === checksum;

console.log('Tampered data is valid:', isIntact);
console.log('Empty buffer CRC32:', zlib.crc32(Buffer.alloc(0)));
