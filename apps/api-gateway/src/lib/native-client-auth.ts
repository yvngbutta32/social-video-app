export const NATIVE_CLIENT_HEADER = 'x-viralboost-client';

export function isNativeViralBoostClient(clientHeader: string | undefined) {
  return clientHeader === 'native';
}

export function withNativeRefreshToken<T extends Record<string, unknown>>(
  data: T,
  refreshToken: string,
  clientHeader: string | undefined
) {
  return isNativeViralBoostClient(clientHeader)
    ? { ...data, refreshToken }
    : data;
}
