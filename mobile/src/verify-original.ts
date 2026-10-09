import {File} from 'expo-file-system';
import type {Photo} from './domain';
import {sha256} from './integrity';
export async function verifyOriginal(uri:string,photo:Photo){const file=new File(uri);if(file.size!==photo.bytes)throw new Error('원본 파일 크기가 일치하지 않아요. 다시 다운로드해주세요.');if(photo.sha256&&await sha256(await file.arrayBuffer())!==photo.sha256)throw new Error('원본 파일 검증에 실패했어요. 다시 다운로드해주세요.');}
