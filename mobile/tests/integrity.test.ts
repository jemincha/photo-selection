import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256} from '../src/integrity.ts';
test('LAN-compatible checksum matches standard SHA-256 for empty, text and binary files',async()=>{for(const bytes of [new Uint8Array(),new TextEncoder().encode('abc'),Uint8Array.from({length:4096},(_,i)=>i%256)]){assert.equal(await sha256(bytes.buffer as ArrayBuffer),createHash('sha256').update(bytes).digest('hex'));}});
