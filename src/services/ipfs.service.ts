import fetch from 'node-fetch';

const PINATA_API = 'https://api.pinata.cloud';

function headers(): Record<string, string> {
  const key = process.env['PINATA_API_KEY'];
  const secret = process.env['PINATA_SECRET_API_KEY'];
  if (!key || !secret) throw new Error('PINATA_API_KEY and PINATA_SECRET_API_KEY must be set');
  return { pinata_api_key: key, pinata_secret_api_key: secret, 'Content-Type': 'application/json' };
}

export interface PinResult {
  ipfsHash: string;
  gatewayUrl: string;
}

export async function pinJSON(name: string, body: Record<string, unknown>): Promise<PinResult> {
  const res = await fetch(`${PINATA_API}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ pinataMetadata: { name }, pinataContent: body }),
  });

  if (!res.ok) throw new Error(`Pinata error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { IpfsHash: string };
  return { ipfsHash: data.IpfsHash, gatewayUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}` };
}
