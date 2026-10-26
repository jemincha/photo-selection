# Supabase CLI · 설렉에서 쓰는 법

2026-10-22 · 실제 확인 버전 2.121.0 · 기준 템플릿: `C:/Users/jemin/.codex/templates/opensource-skill-guide.md`.

## 1. 한눈에 이해하기

서버 구조 변경을 파일로 남기고 검증 환경에 적용하는 명령 도구다. 설렉의 공유 시 사진 고정·초대 격리에 사용한다. 화면 색상이나 글을 바꾸는 작업에는 필요 없다.

## 2. 실제 설치 범위

공식 npm `supabase` CLI 2.121.0을 npm exec 캐시로 내려받아 실행했다. 전역 설치나 앱 의존성 추가를 하지 않았다. Node/npm과 Windows를 사용했다. npm 캐시의 임시 패키지 경로는 npm이 관리하며 프로젝트에는 migration과 무시되는 `supabase/.temp/`가 생성됐다. 기존 Supabase 스킬/MCP는 별개이며 새로 설치하지 않았다. Docker, 로컬 DB, 원격 프로젝트, 키는 설정하지 않았다.

## 3. 작동 구조

사용자 요구 → Codex가 기존 SQL 검토 → CLI로 migration 파일 생성 → SQL 작성 → 테스트 DB에서 권한/경쟁 검증 → 검토 후 서버 적용.

이번에 확인한 범위는 **파일 생성·버전 출력**까지다. 파일 등록과 서버 실행을 혼동하지 않는다. 앱은 React Native/Expo, CLI는 서버 변경 이력을 담당한다.

## 4. 바로 쓰는 방법

저장소 루트 PowerShell에서 버전/도움말 확인:

```powershell
npm.cmd exec --yes --package=supabase@2.121.0 -- supabase --version
npm.cmd exec --yes --package=supabase@2.121.0 -- supabase migration new --help
```

복사할 요청문:

> 설렉 저장소의 Supabase CLI 2.121.0과 기존 migration을 확인해줘. 원격 연결이나 DB 변경은 하지 말고 현재 파일 순서와 추가 SQL의 권한 검증 항목만 정리해줘.

> docs/app-store-release.md를 기준으로 simple_v2 migration의 테스트 DB 검증을 이어가줘. 계정·서버가 준비됐는지 먼저 확인하고 기존 데이터를 보존해줘.

## 5. 내 기존 프로젝트 적용

실제 확인한 프로젝트는 설렉 하나다. 다른 프로젝트를 임의로 탐색하지 않았다. 설렉의 기존 흐름은 앨범 단위 멤버십이며 새 요청은 독립 공간과 공유 후 사진 고정을 추가한다. 첫 과제는 `20261022110646_simple_v2.sql` 검토, 성공 기준은 기존 공동 앨범 호환과 새 요청의 비멤버 접근 차단·공유 후 사진 추가 차단이다. 현재 문서·SQL·테스트가 기준이며 CLI 결과가 제품의 진도표를 대체하지 않는다. 기획·개인정보 안내 같은 비코딩 산출물도 실제 서버 동작에 맞춰 갱신해야 한다.

## 6. 기대효과와 한계

검증: 버전 출력과 migration 파일 생성 성공. 공식 기능: 로컬 개발·migration·DB 테스트 도구. 제안: 서버 준비 뒤 권한 회귀 검증에 활용. 시간 절감·안전성 향상률은 측정하지 않았다. 최초 실행/버전 변경은 다운로드가 필요할 수 있고, 로컬 DB에는 별도 Docker 환경이 필요하다. CLI 설치가 Supabase 가입·서버 생성·과금 동의를 뜻하지 않는다.

## 7. 작은 시험 과제

입력은 현재 SQL 세 파일이다. 새 파일을 다시 만들거나 적용하지 않고, 생성 순서와 공개 RPC의 EXECUTE 권한·회원 검사를 검토한다. 완료 기준은 새 SQL의 검토 결과와 아직 실행하지 않은 항목을 `app-store-release.md`에 남기는 것. 실제 DB 검증은 별도다.

## 8. 관리·복구·출처

명령 실행을 중지하면 이번 CLI 작업은 종료된다. 전역 서비스나 시작 프로그램을 설치하지 않았다. 사용하지 않으려면 npm exec를 호출하지 않으면 된다. 캐시 정리는 필요할 때 해당 패키지만 확인한 뒤 수행하고 npm 전체 캐시나 프로젝트 SQL을 무턱대고 지우지 않는다. 업데이트는 버전을 명시해 실행하고 기존 migration을 보존한 상태에서 테스트 환경으로 재검증한다. `.env`와 인증 정보를 커밋하지 않는다. [CLI 공식 안내](https://supabase.com/docs/guides/local-development/cli/getting-started), [공식 소스](https://github.com/supabase/cli), [현재 migration](../supabase/migrations/20261022110646_simple_v2.sql). DB 적용/권한/성능은 아직 검증하지 않았다.
