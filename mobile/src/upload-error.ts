export type UploadStage='queue'|'read'|'hash'|'preview'|'store'|'transfer';
export function uploadError(stage:UploadStage,error:unknown,mime=''){
 const detail=error instanceof Error?`${error.name}: ${error.message}`:String(error);
 const quota=/quota|exceeded.*storage|storage.*full/i.test(detail);
 const advice=quota?'Safari의 저장 공간이 부족해요. 더 작은 사진 한 장으로 시도해주세요.':stage==='read'?'사진 파일을 읽지 못했어요. 사진 앱에서 해당 사진을 열어 다운로드를 기다린 뒤 다시 선택해주세요.':stage==='preview'?`${/hei[cf]/.test(mime)?'이 HEIC/HEIF 파일을 Safari에서 처리하지 못했어요.':'사진 미리보기를 만들지 못했어요.'} 사진 앱에서 다운로드 완료 후 다시 선택하거나 JPEG/PNG 파일로 시도해주세요.`:stage==='store'?'사진을 기기에 저장하지 못했어요. Safari 일반 탭에서 저장 공간을 확인하고 다시 시도해주세요.':'사진 전송에 실패했어요. 네트워크를 확인한 뒤 다시 시도해주세요.';
 const label={queue:'임시 보관',read:'파일 읽기',hash:'원본 검증',preview:'미리보기 생성',store:'기기 저장',transfer:'서버 전송'}[stage];
 return new Error(`[${label}] ${advice}\n오류: ${detail}`);
}
