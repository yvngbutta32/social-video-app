import { isPrivateOrReservedAddress } from '../src/routes/webhooks.js';

const blocked = ['127.0.0.1', '10.0.0.1', '172.16.1.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', 'fe80::1'];
const publicAddresses = ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'];

for (const address of blocked) {
  if (!isPrivateOrReservedAddress(address)) throw new Error(`${address} must be blocked as a private or reserved webhook destination.`);
}
for (const address of publicAddresses) {
  if (isPrivateOrReservedAddress(address)) throw new Error(`${address} must remain eligible as a public webhook destination.`);
}
console.log('Webhook delivery security verification passed.');
