const pino = require('pino');
console.log('Keys:', Object.keys(pino));
console.log('Default type:', typeof pino.default);
console.log('Is callable:', typeof pino === 'function');