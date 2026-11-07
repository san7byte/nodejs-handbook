import process from 'node:process';

const userArgs = process.argv.slice(2);
const portIndex = userArgs.indexOf('--port');
const portValue = portIndex !== -1 ? userArgs[portIndex + 1] : undefined;

// Edge-case: flag exists but value is missing or another flag
const hasValue = portValue !== undefined && !portValue.startsWith('--');
const parsedPort = hasValue ? Number(portValue) : null;
const isValid = parsedPort !== null && Number.isInteger(parsedPort);

console.log('User args:', userArgs);
console.log('Port value provided:', hasValue);
console.log('Resolved port:', isValid ? parsedPort : 3000);
