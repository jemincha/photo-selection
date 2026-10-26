# 의존성 보안 기록 · 2026-10-26

## SDK 58 갱신 후 재검사 · 2026-10-26

실제 iPhone Expo Go가 SDK 58을 요구해 Expo 58.0.19·Router 58.0.26·React Native 0.88.0·React 19.3.0과 호환 Expo 모듈로 갱신했다. 아래 SDK 57 기록은 당시 이력이다.

새 잠금 파일에는 `query-string`과 `decode-uri-component`가 없다. Router 58의 실제 `parseQueryParams`를 불러 한국어·이모지·반복 매개변수·손상 인코딩·긴 입력 검사를 수행한다. 이전 vendored 디코더 소스와 override는 설치 복구를 위해 남겼지만 현재 설치 트리와 번들에는 해당 패키지가 없다.

`npm audit --json`은 **high 5개, moderate/critical 0개**를 보고했다. node-forge 서명 검증 권고와 CLI가 사용하는 Zod 3 계열의 컬렉션 검사 메모리 소진 권고에서 CLI/Expo로 전파된 항목이다. 직접 설치된 Zod 4.6.7과 별개로 CLI는 `^3.25.76`을 요구하므로, 이를 임의로 Zod 4로 강제 대체하지 않았다. Expo를 54로 내리는 감사 도구의 강제 수정 제안도 적용하지 않는다. `review-evidence.json`의 dependencies는 계속 pending이다.

현재 감사 출력은 로컬 `mobile/.expo/sdk58-audit.json`, 이전 의존성 복구 사본은 `mobile/.expo/sdk58-install-backup`에 있으며 둘 다 커밋 대상이 아니다. 최종 배포 전 upstream 수정과 실제 서명 환경을 재검토한다. [Zod 권고](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) · [node-forge 권고](https://github.com/advisories/GHSA-86w9-cpqp-85rv)

## 적용한 수정

- Expo `~57.0.27` → `~57.0.31`, Expo Router `~57.0.25` → `~57.0.29`. SDK 58로 올리거나 npm의 강제 수정 제안에 따라 SDK 44로 내리지 않았다. 실제 해석 버전은 `mobile/package-lock.json`에 기록한다.
- URL/query 처리 경로의 `decode-uri-component`는 공식 보안 수정 버전 0.5.0으로 교체했다. Router 57의 query-string 7은 CommonJS 함수를 동기 호출하므로 공식 0.5.0 소스에서 export 선언만 CommonJS로 바꾼 MIT 호환 복사본을 npm override로 사용한다.
- 복사본의 원본 SHA-256·배포 tarball SHA-1·저작권·라이선스를 `mobile/vendor/decode-uri-component`에 기록했다. 자동 검사에서 원래 export 선언을 복원한 소스 해시를 대조해 알고리즘을 수정하지 않았는지 확인한다.
- 한국어·이모지·반복 query 매개변수·잘못된 percent 인코딩과 긴 악성 형태의 입력을 검사한다. 긴 입력은 제한 시간이 있는 별도 프로세스에서 실행한다. Router가 공식 수정 버전을 직접 지원하면 override와 복사본을 제거하고 같은 검사를 다시 실행한다.

## 남은 경고

초기 npm 감사는 종속 경로를 포함해 24개(고위험 18·중간 6), SDK 호환 패치 후 21개(고위험 18·중간 3)를 보고했다. URL 디코더 수정 후 npm 설치 감사에는 **고위험 18개 경로 경고**가 남았다. 이는 서로 다른 18개 앱 취약점을 의미하지 않으며, 아래 두 원인 패키지에서 전파된 결과다. ‘취약점 0개’로 기록하지 않는다.

| 원인 | 설치 버전 | 사용 경로 | 현재 조치 |
|---|---|---|---|
| braces | 3.0.3 | micromatch → Metro 파일 탐색·빌드 도구 | 공식 수정판 없음. 외부의 glob 패턴을 받는 서비스를 만들지 않고 개발 서버를 외부에 공개하지 않는다 |
| node-forge | 1.4.0 | Expo CLI·코드 서명 인증서 빌드 도구 | 공식 수정판 없음. 신뢰하지 않는 인증서·키·빌드 입력을 사용하지 않고 EAS 서명 환경을 최종 검토한다 |

위 경로는 설치된 의존 트리에서 확인한 빌드 도구 경로다. 서명된 최종 바이너리 전체의 보안 적합성이나 노출 부재를 보증하는 분석은 아니다. 출시 전에 공식 수정판·Expo 권고와 실제 빌드 환경을 다시 확인해야 하므로 `review-evidence.json`의 dependencies 항목을 pending으로 유지한다. npm `audit fix --force`로 무관한 주요 버전을 강제 적용하지 않는다.

## 재검사

`mobile`에서 `npm audit --omit=dev`와 `npm ls decode-uri-component braces node-forge --all`을 확인한다. `./scripts/verify.ps1`는 동작·SQL·빌드 회귀를 검사하지만 npm 감사의 미해결 항목을 없애지 않는다. 빌드 도구 경고의 최종 판단은 별도로 기록한다. 소스 지도나 내부 경로가 들어간 개발 산출물을 그대로 외부에 공개하지 않는다.

공식 근거: [디코더 권고와 수정 버전](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [공식 0.5.0 릴리스](https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0), [braces 권고](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [node-forge 권고](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
