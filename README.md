# 설렉 · 사진 셀렉

## 2026-10-23 · 출시 전 개발·검증

**사진 선택 → 친구에게 보내기 → 골라주기 → 결과 결정·iPhone 원본 앨범 저장**의 핵심 흐름과 신고·차단·초대 관리·삭제 코드를 구현했습니다. 하단 네 탭을 보관함 하나로 줄이고 기존 공동 앨범 URL은 호환 경로로 유지합니다. 확정 후 서버 사진은 30일 보관하며 직접 삭제할 수 있습니다.

현재 자동 검사 57개(앱 40·SQL/RLS 9·서버 작업 6·출시 도구 2), lint·앱/Edge 타입 검사·웹 export가 통과했습니다. iOS Hermes 번들도 생성했습니다. 서명된 설치 앱, 실제 서버 또는 Photos 실기기 검증을 뜻하지 않습니다.

Apple Developer·Supabase 프로젝트·실제 안전 검사 API 키와 운영자·문의처는 준비 전입니다. 출시 자료 초안과 공개 정책 페이지 템플릿은 준비했지만 실제 값과 서버·실기기 검증 없이는 제출할 수 없습니다. 심사·배포는 하지 않았습니다.

- [아침 계정 준비 가이드북 · 화면형 체크리스트](docs/morning-setup-guide.html) / [Markdown](docs/morning-setup-guide.md)
- [Apple 유료 가입 전 iPhone · Expo Go 테스트 안내](docs/iphone-expo-go-guide.md)
- [2026-10-26 iPhone 테스트 피드백 · 다음 업데이트 검토용](docs/iphone-test-feedback-20261026.md)
- [심플 개편안](docs/seollek-v2-simple-product-brief.md)
- [최신 구현·검증 기록](docs/app-store-release.md)
- [계정 준비 후 연결·운영 절차](release/operations.ko.md)
- [스토어 설명·심사 노트 초안](release/store-listing.ko.md)
- [실제 검증 대기 목록](release/review-evidence.json)

로컬 검사: `./scripts/verify.ps1` · 출시 점검: `node scripts/release-check.cjs`(현재 실패가 정상).

서버 migration 네 파일은 파일명 순으로 테스트 환경부터 적용합니다. 공개 정책 페이지는 `release/legal-settings.example.json`을 실제 값으로 채우고 `node scripts/build-legal-site.cjs`로 생성합니다. 생성과 배포는 별개입니다.

## 과거 MVP 기록

아래 설명은 이전 공동 앨범 MVP의 이력입니다. 현재 동작은 위 문서와 출시 기록을 우선합니다.

함께한 여행이나 이벤트의 사진을 앨범에 모으고 서로 골라주는 앱입니다. 닉네임으로 시작하며, 같은 앨범 안에서 내 사진을 요청하고 친구 사진을 셀렉할 수 있습니다.

현재는 **로컬 웹 MVP**를 직접 테스트하는 단계입니다. iPhone 12 Safari에서 셀렉 흐름의 정상 동작을 사용자 확인했습니다. Supabase 연결 코드와 네이티브 iOS 저장 코드는 준비했으나 실서버·네이티브 실기기 검증은 아직 진행하지 않았습니다.

## 핵심 흐름

1. 닉네임 설정 → 앨범 생성 → 앨범 안에 내 사진 요청 추가.
2. 실제 사진 선택·업로드 → 친구에게 셀렉 요청.
3. `별로 / 글쎄 / 좋아`로 분류하면 다음 사진으로 자동 이동.
4. 오른쪽 스와이프로 이전 사진에 돌아가 분류 수정. 왼쪽 스와이프는 다음 사진 탐색.
5. 모든 사진을 분류한 뒤 제출 → `좋아`로 고른 조합 표시. 텍스트 의견은 선택사항이며 좋아 0장도 제출 가능.
6. 요청자가 참여자의 제출 조합을 참고해 최종 사진을 확정.

각 요청의 사진을 올린 사람이 최종 확정 권한을 갖습니다. 별도 역할 모드를 선택하지 않습니다. 분류 수정은 해당 참여자의 제출을, 새 사진 추가는 해당 요청의 모든 제출을 무효화합니다. 최종 확정 이후 분류와 의견은 읽기 전용입니다.

## 실행

Node.js와 npm이 설치된 Windows PowerShell에서 **프로젝트 루트 기준**으로 실행합니다.

```powershell
cd mobile
npm.cmd ci
npm.cmd run web
```

iPhone Safari에서 같은 Wi-Fi로 접속하려면:

```powershell
# mobile 폴더에서 실행
$env:EXPO_OFFLINE = "1"
npm.cmd run web -- --host lan --port 8082
```

iPhone 주소창에는 `http://<PC의 Wi-Fi IPv4 주소>:8082`를 입력합니다. 노트북과 서버는 실행 상태로 유지합니다. 주소 확인, 방화벽 확인, 테스트 순서는 [iPhone 테스트 가이드](docs/iphone-test-guide.md)를 참고하세요.

로컬 모드의 `이 요청을 테스트 친구로 열기` 버튼은 같은 브라우저에서 역할과 분류를 검증하는 도구입니다. PC와 iPhone 또는 서로 다른 브라우저의 데이터는 공유되지 않습니다. 실제 친구와 다른 기기에서 공유하려면 Supabase 연결과 웹 배포가 필요합니다.

## 사진 처리와 제한

- 업로드할 원본 파일과 720px JPEG 썸네일을 분리합니다. 원본 파일의 크기와 SHA-256을 기록합니다.
- 웹 로컬 원본/썸네일은 IndexedDB에 파일로 보관하고 요청 정보는 AsyncStorage에 저장합니다. 기존 문자열 사진도 읽을 수 있습니다.
- 한 장 최대 25MB. JPEG·PNG·WebP와 디코딩 가능한 HEIC/HEIF를 지원합니다. Safari의 HEIC 처리·메모리 제약이 있으므로 처음에는 1~3장씩 테스트하세요.
- 업로드 상태, 파일 형식·크기, 실패 단계와 오류를 표시하고 실패 항목을 재시도할 수 있습니다.
- iCloud 최적화 사진은 기기에 원본이 없을 수 있습니다. 사진 앱에서 다운로드를 기다린 뒤 재선택하세요. 현재 오류 개선은 큰 파일의 로컬 저장 한계와 진단을 보완한 것이며, 모든 iCloud/HEIC 사례의 해결을 보장하지 않습니다.
- 웹에서는 사진첩 직접 저장과 iOS 사진 권한 설정 버튼을 제공하지 않습니다. 네이티브 코드에서는 권한 거절 시에만 설정 열기를 안내하고 원본 저장 전 크기·체크섬을 검증합니다.

여기서 원본은 **사진 선택기가 전달한 업로드 파일**입니다. 기기 카메라 원본과 선택기 결과의 동일성, 사진첩 저장 및 외부 앱의 표시 순서는 별도 실기기 검증 대상입니다.

## Supabase 연결 준비

1. Supabase 프로젝트를 생성합니다.
2. 아래 SQL을 파일명 순서대로 적용합니다.
   - `supabase/migrations/202610080001_mvp.sql`
   - `supabase/migrations/202610090001_albums_and_submissions.sql`
3. Auth에서 Anonymous Sign-ins를 활성화합니다.
4. `mobile/.env.example`을 `mobile/.env`로 복사하고 프로젝트 URL과 publishable/anon 키를 설정합니다. service_role/secret 키는 앱에 넣지 않습니다.
5. Expo 서버를 다시 시작합니다.
6. 웹 배포 후 `EXPO_PUBLIC_WEB_URL`을 설정하고 `/invite/*`, `/albums/*`, `/requests/*` 등 앱 경로가 `index.html`로 연결되도록 SPA rewrite를 설정합니다.

앨범 멤버는 기존·확정된 요청과 앞으로 추가되는 요청을 함께 볼 수 있습니다. 현재 최대 참여자는 앨범당 3명입니다. 기존 독립 요청은 각각의 앨범으로 이관합니다. SQL에는 비공개 Storage, 멤버십 RLS, 권한 검증 RPC가 포함되며 실제 실행·권한·동시성 검증은 아직 남아 있습니다. 갱신은 5초 폴링을 사용합니다.

## 기술 구성

| 영역 | 구성 |
|---|---|
| 앱·웹 | Expo SDK 57, React Native 0.86, React 19, TypeScript |
| 화면 이동 | Expo Router |
| 사진 선택·처리 | Expo ImagePicker, ImageManipulator, FileSystem, MediaLibrary |
| 로컬 저장 | AsyncStorage + 웹 IndexedDB |
| 체크섬 | SHA-256 (`@noble/hashes`) |
| 서버 준비 | Supabase Auth, Postgres, 비공개 Storage |
| 빌드 준비 | EAS development/preview/production 설정 |

소셜 로그인은 현재 제공하지 않습니다. 표시용 닉네임과 내부 사용자 ID를 분리해 추후 계정 연결을 준비합니다. Google·Apple·Kakao 등은 제공자 설정과 익명 사용자 데이터 연결을 별도로 검증해야 하며 Instagram 일반 로그인 가능 여부도 확인 대상입니다.

SDK 57의 실제 iPhone 네이티브 테스트는 Apple Developer Program 및 Expo/EAS 설정 후 development build 또는 호환 Expo Go 배포가 필요합니다. Windows에서도 EAS 클라우드 빌드는 가능합니다. 자세한 제약은 [Expo 공식 안내](https://docs.expo.dev/troubleshooting/expo-go-version-mismatch/)와 iPhone 테스트 가이드를 참고하세요.

## 검증 상태

```powershell
# mobile 폴더에서 실행
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run export:web
```

- lint·TypeScript 검사 통과.
- 자동 테스트 10개 통과: 권한, 분류 격리, 제출/확정 상태, 체크섬, 8MB 파일 저장·복원, 기존 이미지 호환, 오류 구분. IndexedDB 테스트는 fake-indexeddb 기반입니다.
- 브라우저에서 앨범 생성, 사진 업로드, 분류 후 자동 이동, 스와이프 수정, 의견 없는 제출, 조합 표시, 공동 앨범 요청, 새로고침 후 기록 보존, 최종 확정 화면을 확인했습니다.
- 사용자 iPhone Safari 셀렉 기능 정상 작동 확인. 웹 권한 설정 오류를 수정했습니다.
- 웹 production export 및 iOS JavaScript 번들 검증 이력이 있습니다. iOS 번들 검증은 설치 가능한 네이티브 빌드나 실기기 테스트를 뜻하지 않습니다.

상세 이력과 미검증 항목은 [테스트 체크리스트](docs/mvp-test-checklist.md)에 기록합니다. 실제 Supabase 연결, iOS 원본 저장, iCloud/HEIC의 다양한 사례는 추가 검증이 필요합니다.

## 프로젝트 구성

```text
mobile/                  실제 Expo 앱·웹, 테스트, 환경변수 예시
supabase/migrations/     초기 스키마 및 앨범/제출 후속 SQL
wireframes/              기존 검토용 HTML 와이어프레임
docs/                   기획·테스트·실기기 가이드·UIUX 개선안
```

- [기획과 합의 사항](docs/plan-v0.4.md): 날짜별 후속 변경이 기존 정책보다 우선합니다.
- [UIUX 다음 개선안](docs/uiux-next-iteration.md): 사진 상세 → 제출 전 확인 → 제출 완료부터 재설계하는 제안입니다. 아직 전체 개선을 구현한 상태는 아닙니다.

초기 와이어프레임은 과거 시안이며 최신 구현과 기획 변경을 우선합니다. 조합 자동 추천·게시 순서 지정·Instagram 자동 게시·사진 삭제·기존 앨범 병합은 현재 범위에 포함되지 않습니다. 외부 배포 전에는 계정/데이터 삭제, 보관 정책, 초대 폐기와 개인정보 안내 등을 추가해야 합니다.
## 2026-10-10 UIUX 개선

사진 상세는 화면 안에 사진 전체와 세 분류 버튼을 배치한다. 좌우 스와이프로 탐색하고 분류하면 자동으로 다음 사진으로 이동한다. 분류를 마치면 **내 조합 확인 → 셀렉 제출 → 제출 완료 → 앨범** 순서로 진행한다. 제출 전 확인 화면에서는 좋아 사진 조합과 세 분류 개수를 확인하고 사진을 눌러 수정할 수 있다.

앨범 목록은 표지 중심 2열 카드로 표시한다. 프로필·초대·관리·테스트 도구는 보조 영역에서 연다. 사진 추가는 선택 후 바로 준비를 시작하며, 실패한 항목만 재시도한다. 자세한 변경과 실기기 재검증 항목은 [UIUX 개선안](docs/uiux-next-iteration.md)과 [테스트 체크리스트](docs/mvp-test-checklist.md)에 기록했다.

웹 사진 준비는 원본을 한 장씩 처리하고, 선택 목록과 임시 파일을 보관해 같은 주소에서 중단 후 이어갈 수 있다. 작은 미리보기와 단계별 처리 시간을 제공한다. iCloud 파일 전달 전 대기와 Safari 실기기 검증의 제한은 [업로드 성능·복원 기록](docs/upload-performance-and-recovery.md)을 참고한다.

## 설렉 메인과 하단 탭

가제 **설렉**으로 온보딩과 홈·앨범·친구·마이페이지를 구성했다. 홈은 진행 중인 셀렉과 분류 진행률을 보여주고, 앨범 모음은 2열 카드로 표시한다. 친구는 함께한 앨범의 참여자 목록이며 마이페이지에서 닉네임을 변경한다. [메인 구조와 디자인 방향](docs/main-navigation.md)에 참고 사이트와 구현 범위를 기록했다.
