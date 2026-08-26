import assert from 'node:assert/strict';
import { isNativeViralBoostClient, NATIVE_CLIENT_HEADER, withNativeRefreshToken } from '../src/lib/native-client-auth.js';

const baseResponse = { user: { id: 'creator-1' }, accessToken: 'short-lived-token' };

assert.equal(NATIVE_CLIENT_HEADER, 'x-viralboost-client');
assert.equal(isNativeViralBoostClient('native'), true);
assert.equal(isNativeViralBoostClient('web'), false);
assert.equal(isNativeViralBoostClient(undefined), false);

const nativeResponse = withNativeRefreshToken(baseResponse, 'rotated-refresh-token', 'native');
assert.equal(nativeResponse.refreshToken, 'rotated-refresh-token');

const browserResponse = withNativeRefreshToken(baseResponse, 'rotated-refresh-token', 'web');
assert.deepEqual(browserResponse, baseResponse, 'Browser response must not expose a refresh token in JSON.');

console.log('Native client authentication boundary verification passed.');
