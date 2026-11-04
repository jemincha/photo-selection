import {CryptoDigestAlgorithm,digest} from 'expo-crypto';

// Keep binary SHA-256 verification while moving native hashing off the JS loop.
export async function sha256(bytes:ArrayBuffer){return Array.from(new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256,bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function sha256Blob(blob:Blob){return sha256(await blob.arrayBuffer());}
