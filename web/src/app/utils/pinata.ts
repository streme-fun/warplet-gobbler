import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY_URL!,
});

export async function uploadToPinata(file: File): Promise<string> {
  const result = await pinata.upload.public.file(file);
  return `https://${process.env.PINATA_GATEWAY_URL}/ipfs/${result.cid}`;
}
