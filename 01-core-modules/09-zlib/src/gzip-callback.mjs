import zlib from 'node:zlib';

// Normal: compress and decompress using native callbacks
const sourceText = 'Fast and scalable backend systems with Node.js';
const sourceBuffer = Buffer.from(sourceText);

zlib.gzip(sourceBuffer, { level: 6 }, (gzipErr, compressed) => {
  if (gzipErr) {
    console.error('Gzip failed:', gzipErr.code);
    return;
  }

  zlib.gunzip(compressed, (gunzipErr, decompressed) => {
    if (gunzipErr) {
      console.error('Gunzip failed:', gunzipErr.code);
      return;
    }

    console.log('Original bytes:', sourceBuffer.length);
    console.log('Compressed bytes:', compressed.length);
    console.log('Decompressed text:', decompressed.toString());
  });
});

// Edge-case: handle corrupted buffer via error parameter in callback
const corruptedBuffer = Buffer.from('not-a-valid-gzip-stream');
zlib.gunzip(corruptedBuffer, (err) => {
  if (err) {
    console.log('Corrupted data error code:', err.code);
  }
});
