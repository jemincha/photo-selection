import {sha256 as hashBytes} from '@noble/hashes/sha2.js';
// LAN HTTP origins do not expose WebCrypto.subtle. Keep checksum verification
// available in Safari without disabling browser security or skipping hashing.
export async function sha256(bytes:ArrayBuffer){return Array.from(hashBytes(new Uint8Array(bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
