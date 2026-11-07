import { URL } from 'node:url';

// Normal: parse absolute URL and relative with base
const api = new URL('/v1/users', 'https://api.example.com:8080');

// Edge-case: defensive validation without try-catch using URL.canParse
const isValid = URL.canParse('https://api.example.com/health');
const isInvalid = URL.canParse('/invalid-without-base');

console.log('Full origin:', api);
/**
  URL {
    href: 'https://api.example.com:8080/v1/users',
    origin: 'https://api.example.com:8080',
    protocol: 'https:',
    username: '',
    password: '',
    host: 'api.example.com:8080',
    hostname: 'api.example.com',
    port: '8080',
    pathname: '/v1/users',
    search: '',
    searchParams: URLSearchParams {},
    hash: ''
  }
*/
console.log('Origin:', api.origin);
console.log('Pathname:', api.pathname);
console.log('Valid URL check:', isValid);
console.log('Invalid URL check:', isInvalid);
