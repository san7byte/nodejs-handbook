import process from 'node:process';

// Normal: read existing variable with fallback
const nodeEnv = process.env.NODE_ENV || 'development';

// Edge-case: missing variable and strict type validation
const rawPort = process.env.PORT;
const port = Number(rawPort);
const isPortValid = Number.isInteger(port) && port >= 1 && port <= 65535;

console.log('Environment:', nodeEnv);
console.log('Raw PORT is undefined:', rawPort === undefined);
console.log('Fallback PORT valid:', isPortValid ? port : 3000);
console.log(process.cwd());
