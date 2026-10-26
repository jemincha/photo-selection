# 설렉 · App Store 등록 초안

최종 입력 전 운영자 정보, 실제 빌드 기능, 배포 URL과 일치하는지 확인한다. 기능이 준비됐다는 증거를 대신하지 않는다.

## 앱 정보

- 이름: 설렉
- 부제: 뭐 올릴까? 친구와 고르는 사진
- 기본 언어: 한국어
- 기본 카테고리 제안: 사진 및 비디오
- 가격·수익화: 현재 결제·구독 코드 없음. 출시 가격은 운영자가 최종 결정.
- 키워드 초안: 사진,셀렉,선택,친구,앨범,게시물,사진고르기,추억,일상

## 프로모션 문구

비슷한 사진 사이에서 고민될 때. 사진을 고르고 링크 하나로 친구의 취향을 물어보세요.

## 설명

뭐 올릴까? 같이 고르면 쉬우니까.

설렉은 게시할 사진을 친구와 함께 고르는 앱이에요. 복잡한 앨범 설정 없이 사진을 고르고, 링크로 부탁하고, 마음에 드는 사진을 결정해요.

• 사진 고르고 바로 부탁하기
최대 30장의 사진을 담고 링크로 보내세요. 함께 고를 친구는 웹에서도 참여할 수 있어요.

• 친구의 취향을 가볍게 묻기
좋아·글쎄·별로로 고르고, 좋아하는 사진 조합을 제출해요. 응답을 받은 뒤에도 마지막 결정은 내가 해요.

• 결정한 원본을 한 앨범에
iPhone 앱에서 사진 권한을 허용하면 확정한 원본을 사진 앱의 별도 앨범에 모아 저장할 수 있어요. 기존 사진과 저장본이 함께 생길 수 있어요.

• 믿을 수 있는 사람과 공유하기
새 셀렉은 요청자 포함 최대 3명이 함께해요. 공개 피드나 외모 순위는 없어요. 공유 전 안전 검사와 신고·차단 기능을 제공해요.

최종 확정 후 서버의 셀렉과 사진은 30일 동안 보관해요. 그 전에도 직접 삭제할 수 있어요. 사진 앱에 저장한 사본은 앱 데이터 삭제 후에도 남아요.

사진은 한 장당 최대 25MB이며 기기·브라우저에 따라 HEIC 미리보기가 제한될 수 있어요. 닉네임으로 시작한 계정은 앱 삭제·기기 변경 뒤 복구되지 않을 수 있어요.

## 심사 노트 초안 (실제 서버 연결 후 보완)

Seollek helps a small group of invited friends choose photos for a post. It does not rank people's attractiveness and has no public feed, random chat, advertising, subscription or in-app purchases.

Users start with a nickname backed by an anonymous Supabase account. From the home screen, pick photos, allow the safety check, and share an invite link. Invited users can classify photos and submit their selection. The owner confirms the final photos and can save the uploaded originals to a dedicated iOS Photos album. Photos permission is requested only when saving. No Instagram login or integration is required.

Reporting, blocking, invite rotation and deletion are available from the ••• menu on photo/result screens. Account deletion is under Home → Settings → Account and Data Deletion. Confirmed server requests expire after 30 days. Saved iOS Photos copies are not deleted.

Before submission, provide a live review invitation, safe sample photos, separate reviewer/owner instructions, a working support contact and a fully deployed backend. **These are not available yet.** Do not submit a local demo as a live collaborative app.

## 스크린샷 촬영 계획

실제 서명된 릴리스 후보에서 촬영한다. 현재 웹 목업을 iPhone 실기기 캡처로 표시하지 않는다.

1. 홈: ‘뭐 올릴까? 같이 고르면 쉬우니까.’와 핵심 버튼.
2. 사진 준비: 안전한 샘플 사진과 선택적 부탁, 공유 준비.
3. 골라주기: 사진 전체 보기와 좋아·글쎄·별로.
4. 친구 픽: 제출된 응답과 최종 후보.
5. 최종 결과: 실제 iOS 앨범 저장 완료 상태.

스크린샷의 기기 크기·해상도는 App Store Connect의 당시 요구 사항을 확인한다. 예시 인물 사진은 사용 허가된 자료나 가상 이미지로 한정한다.

## App Privacy·연령 등급 입력 자료

최종 답변은 실제 제공자 설정·운영 정책을 반영해 운영자가 검토한다. 아래를 그대로 ‘미수집’으로 제출하면 안 된다.

| 데이터 | 실제 사용 | 검토할 분류 |
|---|---|---|
| 익명 Auth 사용자 ID·닉네임 | 계정, 참여, 선택 기록 연결 | 식별자·사용자 콘텐츠·사용자와의 연결 여부 |
| 사진 원본·미리보기 | 서버 보관, 참여자 표시, 요청자 원본 저장 | 사진 또는 비디오·사용자 콘텐츠 |
| 부탁·선택·제출 기록 | 협업 기능 제공 | 사용자 콘텐츠·제품 상호작용 |
| 신고 내용 | 운영 검토, 최대 90일 | 고객 지원·기타 사용자 콘텐츠 |
| 사진 미리보기·부탁 문구 | OpenAI 안전 검사 | 제3자 처리·국외 이전·제공자 보관 조건 |
| 서버 접속 로그 | 호스팅·보안 운영 | 실제 IP/진단 보관 여부를 제공자 설정에서 확인 |

광고 SDK·추적 SDK·연락처·정밀 위치 수집 코드는 없다. 원본 EXIF에는 사용자가 찍은 위치가 포함될 수 있다. 연령 등급은 UGC·사진 공유·신고 기능을 사실대로 답하고 현재 설문 결과를 따른다.
