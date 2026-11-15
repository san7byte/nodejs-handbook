import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { text, json, buffer } from 'node:stream/consumers';

// Normal: mengonsumsi readable stream menjadi string utuh via text()
const textStream = Readable.from(['Hello, ', 'world ', 'from consumers!']);
const textResult = await text(textStream);
console.log('Consumed text:', textResult);

// Normal: mengonsumsi dan mem-parsing readable stream menjadi objek JSON via json()
const payload = { service: 'auth-api', active: true, port: 8080 };
const jsonStream = Readable.from([JSON.stringify(payload)]);
const jsonResult = await json(jsonStream);
console.log('Consumed JSON service name:', jsonResult.service);
console.log('Consumed JSON port:', jsonResult.port);

// Normal: mengonsumsi readable stream biner menjadi satu instance Buffer utuh via buffer()
const binaryStream = Readable.from([Buffer.from([0x01, 0x02]), Buffer.from([0x03, 0x04])]);
const bufferResult = await buffer(binaryStream);
console.log('Consumed Buffer length:', bufferResult.length);
console.log('Consumed Buffer hex:', bufferResult.toString('hex'));

// Edge-case: penanganan stream JSON yang rusak (malformed)
const malformedStream = Readable.from(['{ "broken": true, ']);
try {
  await json(malformedStream);
} catch (err) {
  console.log('Malformed JSON error caught:', err.name);
}

// Edge-case: mengonsumsi stream kosong menghasilkan string kosong dengan panjang 0
const emptyStream = Readable.from([]);
const emptyResult = await text(emptyStream);
console.log('Empty stream text length:', emptyResult.length);
