import { URLSearchParams } from 'node:url';

// Normal: menyusun dan memanipulasi query parameters
const params = new URLSearchParams('sort=asc&page=1');
params.set('page', '2');
params.append('filter', 'active');
params.append('filter', 'verified');

// Edge-case: encoding karakter khusus dan parsing query string berawalan '?'
const rawQuery = new URLSearchParams('?tag=node%2Bjs&q=c%2B%2B');

console.log('Page:', params.get('page'));
console.log('Filters:', params.getAll('filter'));
console.log('Serialized:', params.toString());
console.log('Decoded tag:', rawQuery.get('tag'));
console.log('Decoded q:', rawQuery.get('q'));
