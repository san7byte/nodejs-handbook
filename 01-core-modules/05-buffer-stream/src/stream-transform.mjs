import { Transform } from 'node:stream';

// Normal: membuat Transform stream untuk mengubah teks menjadi huruf kapital (uppercase)
const upperTransform = new Transform({
  transform(chunk, encoding, callback) {
    const upperText = chunk.toString('utf8').toUpperCase();
    this.push(upperText);
    callback();
  },
  // Normal: flush dipanggil ketika semua chunk selesai diproses sebelum stream ditutup
  flush(callback) {
    this.push('\n[STREAM_COMPLETED]\n');
    callback();
  },
});

upperTransform.on('data', (chunk) => {
  process.stdout.write(chunk.toString());
});

upperTransform.write('alpha\n');
upperTransform.write('beta');
upperTransform.end();

// Edge-case: Transform stream dengan validasi payload dan penanganan error aman
const validatorTransform = new Transform({
  transform(chunk, encoding, callback) {
    const text = chunk.toString('utf8');
    if (text.includes('INVALID')) {
      return callback(new Error('Payload validation failed: INVALID detected'));
    }
    callback(null, 'OK: ' + text);
  },
});

validatorTransform.on('data', (chunk) => {
  process.stdout.write(chunk.toString());
});

validatorTransform.on('error', (err) => {
  console.log('Validator error caught:', err.message);
});

validatorTransform.write('first chunk\n');
validatorTransform.write('INVALID chunk\n');
