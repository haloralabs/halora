import { getContracts } from '@halora/shared';
import { config } from '@/lib/config';

/** Contract identifiers for the configured network, from `@halora/shared` (contracts.<network>.json). */
export const contracts = getContracts(config.network);
