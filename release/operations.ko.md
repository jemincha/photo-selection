# 설렉 출시 인수인계 · 2026-10-23

현재 원격 배포·심사 신청은 하지 않았다. 아래는 계정 준비 후 실행할 절차다. 실제 서비스 연결과 기기 검증이 끝나기 전 `review-evidence.json`을 passed로 바꾸지 않는다.

## 준비해야 할 실제 값

| 값 | 저장 위치 | 주의 |
|---|---|---|
| Supabase URL·공개 키 | `mobile/.env` / EAS 환경 | 공개 키여도 RLS가 필요하다 |
| 운영자명·문의 이메일·웹 참여·정책·지원 URL | `mobile/.env` | 현재 미정. `.env.example`의 빈값을 실제 값으로 채운다 |
| OpenAI API 키 | Supabase Edge secrets | 추가 서비스 연결이 필요하다. 사진 원본은 보내지 않고 미리보기와 부탁 문구를 검사한다 |
| 유지보수 비밀값 | Edge secrets + Vault | 임의의 충분히 긴 난수. 앱 번들·채팅·Git에 넣지 않는다 |
| 서버 지역·국외 이전·제공자·백업 보관 | `release/legal-settings.json` | 예제 복사 후 실제 운영 설정과 일치하도록 검토한다 |
| iOS bundle ID·EAS 프로젝트·서명 | Apple/EAS 설정 | 앱 식별자를 임의로 확정하지 않았다 |

## 테스트 서버 연결 순서

1. 새로운 **테스트** Supabase 프로젝트를 만들고 익명 Auth를 활성화한다. 기본 Auth 제한·로그·사용량 상한을 점검한다. CAPTCHA를 활성화하려면 클라이언트의 토큰 전달도 먼저 구현·검증해야 한다.
2. `supabase/migrations`의 SQL 네 개를 파일명 순으로 적용한다. 기존 DB라면 백업과 migration 이력을 먼저 확인한다. private 스키마를 Data API에 노출하지 않는다.
3. `app-actions`와 `maintenance` 두 Edge Function을 배포한다. CLI 명령·옵션은 설치된 버전의 `--help`로 확인한다. 사용자 함수의 JWT 검증은 켜 두고, 유지보수 함수는 서버 비밀값을 직접 검사한다. 비밀값이 없으면 실행되지 않는다.
4. Edge secrets에 `OPENAI_API_KEY`, `WEB_ORIGIN`, `SEOLLEK_MAINTENANCE_SECRET`를 설정한다. Supabase 기본 URL·공개 키·service role은 서버 런타임 값이다. 어느 secret도 `EXPO_PUBLIC_`로 만들지 않는다.
5. 웹 참여 앱을 HTTPS에 배포하고 직접 초대 URL을 새 탭에서 열어 SPA 경로 fallback이 동작하는지 확인한다. 정책·지원 페이지는 로그인 없이 접근 가능해야 한다.
6. Vault에 프로젝트 URL과 유지보수 비밀값을 등록한다. 수동 유지보수 호출을 테스트한 뒤 `supabase/operations/enable-maintenance.sql`로 5분 스케줄을 등록한다. 이 파일은 자동 migration이 아니며 아직 실행하지 않았다.
7. 익명 사용자 3명과 비참여자 1명으로 아래 실서버 검사를 수행하고 증거를 기록한다. Supabase 보안 advisor 결과도 확인한다.

## 실제 서버에서 확인할 것

- 비참여자의 테이블 조회·Storage 다운로드·RPC 변경이 모두 차단되는가. 친구가 원본을 다운로드할 수 없는가.
- 승인 전 미리보기·초대 참여가 막히고, 제목/사진이 바뀌면 검사를 다시 요구하는가. 키 누락·검사 오류·오탐 시 우회 공유가 되지 않는가.
- 3명 정원 동시 참여, 링크 교체와 참여 경쟁, 공유와 사진 등록 경쟁에서 정원과 사진 집합이 유지되는가.
- 초대 중지 후 기존 멤버는 남고 새 참여만 막히는가. 차단 후 상대방 요청·Storage 접근이 막히며 본인이 올린 사진은 계속 관리·저장·삭제할 수 있는가.
- 신고 내용이 다른 사용자에게 노출되지 않는가. 운영자가 private 신고 큐를 확인할 수 있는가.
- 파일 삭제 오류를 주입했을 때 DB와 Auth가 먼저 지워지지 않는가. 실패한 작업을 재시도해도 다른 정상 작업이 처리되는가.
- 계정 삭제 후 기존 JWT로 새 앨범·요청·업로드·분류를 만들 수 없는가. Storage·DB·Auth에서 본인 정보가 정리되는가.
- 확정 29일은 유지되고 30일은 접근 차단·정리되는가. 유지보수 중지와 재개 후 밀린 작업이 처리되는가.

PGlite 검사는 PostgreSQL SQL·RLS·권한을 실제 실행하지만 Supabase Auth/Storage HTTP와 다중 DB 세션의 경쟁을 재현하지 않는다. 이미 발급한 signed URL은 만료 전까지 유효할 수 있다(미리보기 최대 5분·원본 2분). 이미 저장된 사본은 회수할 수 없다.

## 신고 운영과 장애 대응

담당자와 공개 이메일은 아직 미정이다. 출시는 담당자가 실제로 신고를 확인할 수 있을 때만 가능하다. 운영 목표로 매일 큐를 확인하고 개인정보 침해·안전 위협을 우선 처리하되, 응답 시간을 사용자에게 약속하려면 실제 인력을 확보한다.

Supabase SQL Editor의 관리자 권한으로 신고를 확인한다. 일반 클라이언트에 service role이나 private 스키마를 열지 않는다.

```sql
select id, request_id, photo_id, target_id, reason, status, created_at
from private.reports where status <> 'resolved' order by created_at;

select kind, count(*), min(created_at) as oldest
from private.cleanup_jobs group by kind;
```

신고 조사 시 필요한 요청만 확인한다. 위반 확정 시 해당 요청을 `deleted_at=now(), invite_enabled=false`로 제한하고 `private.cleanup_jobs`에 request 작업을 등록해 Storage API로 삭제한다. `storage.objects` 행만 직접 SQL로 지우면 실제 파일이 남을 수 있으므로 사용하지 않는다. 반복 악용자는 `private.bans`에 제한 사유와 함께 등록하고 이의 제기 연락처를 제공한다. 익명 계정 재생성까지 완전히 방지하는 시스템은 아니다.

스케줄러의 HTTP 오류·`failed` 수·가장 오래된 대기 작업을 확인한다. 장애 시 공유를 중지하거나 점검 안내를 제공하고 데이터·정책을 먼저 보호한다. 긴 대기 작업을 지우거나 완료 처리해 문제를 숨기지 않는다. 스케줄 중단은 `cron.unschedule('seollek-cleanup')`이며 재개 전 기존 등록 상태를 확인한다.

## 정책·스토어 자료 마무리

`legal-settings.example.json`을 `legal-settings.json`으로 복사하고 검토 후 `node scripts/build-legal-site.cjs`를 실행하면 로컬 `release/site`에 공개용 HTML이 생성된다. 실제 값이 없거나 최종 검토가 끝나지 않으면 생성을 거절한다. 생성은 공개 배포를 하지 않는다. 앱 내 짧은 안내와 공개 전문이 같은 정책을 설명하는지 확인한다.

설명·심사 노트·App Privacy 입력 근거·스크린샷 촬영 목록은 `store-listing.ko.md`에 준비했다. 실제 릴리스 후보 스크린샷, 연락처, 심사용 살아 있는 초대와 접근 안내를 채운다. 원본 EXIF·서버 로그·제3자 처리를 포함해 실제 데이터 취급을 신고한다.

## iPhone·제출 전 통과 조건

Apple/EAS 연결 후 서명된 development build를 설치한다. 전체·제한·거절 사진 권한, HEIC/iCloud 원본, 부분 실패·강제종료, 사용자 앨범 삭제 후 재시도, VoiceOver·큰 글자·키보드·안전 영역을 검사한다. Photos asset 생성과 기록 저장 사이에 강제종료되면 복사본이 추가될 가능성이 남으므로 실제 기기에서 확인하고 안내를 검토한다.

로컬 재검사: `./scripts/verify.ps1`. 출시 점검: `node scripts/release-check.cjs`(현재는 실패가 정상). 마지막 점검을 통과한 뒤 TestFlight 파일럿과 최종 릴리스 후보 검토를 진행한다. 업로드·심사 신청·배포는 별도 단계다.

참고: [Supabase 스케줄링](https://supabase.com/docs/guides/functions/schedule-functions), [Edge 인증](https://supabase.com/docs/guides/functions/auth), [Apple 심사 지침](https://developer.apple.com/app-store/review/guidelines/), [OpenAI 안전 검사](https://developers.openai.com/api/docs/guides/moderation).
