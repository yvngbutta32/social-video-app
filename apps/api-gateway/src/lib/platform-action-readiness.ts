import { listPlatformCapabilities, type PlatformCapability } from './platform-capabilities.js';

type WorkspaceAccount = {
  platform: string;
  username: string | null;
  displayName: string | null;
  isActive: boolean;
  tokenExpiresAt: Date | null;
};

export type PlatformActionReadiness = {
  platform: string;
  label: string;
  actionAllowed: boolean;
  state: 'action_ready' | 'official_connector_required' | 'creator_connection_required' | 'creator_reconnection_required';
  accountName: string | null;
  blockers: string[];
  actionRequirements: PlatformCapability['actionRequirements'];
  safeguards: string[];
};

function currentAccount(accounts: WorkspaceAccount[], platform: string) {
  return accounts.find((account) => account.platform === platform && account.isActive && (!account.tokenExpiresAt || account.tokenExpiresAt > new Date()))
    ?? accounts.find((account) => account.platform === platform)
    ?? null;
}

export function assessPlatformActionReadiness(accounts: WorkspaceAccount[]): PlatformActionReadiness[] {
  return listPlatformCapabilities().map((capability) => {
    const account = currentAccount(accounts, capability.platform);
    const accountName = account?.displayName ?? account?.username ?? null;
    const tokenExpired = Boolean(account?.isActive && account.tokenExpiresAt && account.tokenExpiresAt <= new Date());
    const blockers: string[] = [];

    if (capability.readiness !== 'official_connector_ready') blockers.push('The certified official connector is not deployed and verified for this target.');
    if (!account) blockers.push('A creator-authorized account connection is required.');
    else if (!account.isActive) blockers.push('The prior creator authorization is no longer active and must be reconnected.');
    else if (tokenExpired) blockers.push('The creator authorization has expired and must be reconnected.');

    const state: PlatformActionReadiness['state'] = blockers.length === 0
      ? 'action_ready'
      : capability.readiness !== 'official_connector_ready'
        ? 'official_connector_required'
        : !account
          ? 'creator_connection_required'
          : 'creator_reconnection_required';

    return {
      platform: capability.platform,
      label: capability.label,
      actionAllowed: blockers.length === 0,
      state,
      accountName,
      blockers,
      actionRequirements: capability.actionRequirements,
      safeguards: [
        'This is an action-readiness gate, not a promise that a platform action will succeed.',
        'The creator must still review and explicitly approve a final action.',
        'Platform visibility, recommendation, and reach remain outside ViralBoost control.',
      ],
    };
  });
}
