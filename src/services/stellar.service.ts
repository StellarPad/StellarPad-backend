import { rpc, Horizon } from '@stellar/stellar-sdk';
import { env } from '../config/env';

// Soroban RPC client — used for contract event polling and simulation
export const sorobanRpc = new rpc.Server(env.SOROBAN_RPC_URL, {
  allowHttp: env.NODE_ENV !== 'production',
});

// Horizon client — used for account info and transaction submission
export const horizon = new Horizon.Server(env.HORIZON_URL, {
  allowHttp: env.NODE_ENV !== 'production',
});

/**
 * Verifies connectivity to both Soroban RPC and Horizon.
 * Throws on failure so the caller can decide to retry or abort.
 */
export async function checkStellarConnectivity(): Promise<void> {
  const [health, root] = await Promise.all([
    sorobanRpc.getHealth(),
    horizon.root(),
  ]);

  if (health.status !== 'healthy') {
    throw new Error(`Soroban RPC unhealthy: ${JSON.stringify(health)}`);
  }

  console.log(
    `[stellar] connected — network: ${env.STELLAR_NETWORK}, horizon: ${root.network_passphrase}`,
  );
}
