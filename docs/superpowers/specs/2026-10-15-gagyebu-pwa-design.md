# 가계부 PWA 설계 (안드로이드 이전 단계)

- 작성일: 2026-10-15
- 근거 문서: 가계부 앱 PRD v1.1
- 상태: 사용자 승인 (대화 중 설계 1~3 승인)

## 1. 목적과 범위

PRD의 안드로이드 앱을 만들기 전에, **웹(PWA)으로 가계부 전체와 결제 알림 처리 로직을 먼저 완성**한다.
웹에서는 다른 앱의 알림을 받을 수 없으므로 알림 입력은 **붙여넣기 분석**과 **알림 시뮬레이터**로 대체한다.
완성 후 React Native(Expo) 안드로이드 앱으로 이전하며, `core/`는 그대로 재사용하고 알림 입력부(NotificationListenerService)와 저장소만 교체한다.

### 포함
- PRD P0 전체 (알림 접근 권한은 웹에서 상태 모의로 대체)
- P1 중 붙여넣기 분석(FR-17), CSV 내보내기(FR-19)
- 개발·검증용 알림 시뮬레이터
- 앱 잠금은 PIN 방식

### 제외 (후속)
- 카테고리별 예산, 반복 거래, 기록·예산 알림, 가맹점 분류 규칙 학습
- 분석 이벤트 전송 (이벤트 이름만 내부 로깅 인터페이스로 정의, 전송 없음)
- 계정·백업·동기화

### 가정
- 실제 카드사 알림 샘플이 없으므로 지원 형식은 **가상 형식**으로 정의한다 (§4.1). 실제 형식은 안드로이드 단계 전 샘플 수집 후 추가한다.

## 2. 기술 스택

| 항목 | 선택 |
|---|---|
| 빌드 | Vite |
| UI | React 18 + TypeScript (strict) |
| 라우팅 | react-router (HashRouter) |
| 저장소 | IndexedDB via Dexie |
| 테스트 | Vitest (core는 순수 함수/인메모리 저장소로 테스트) |
| 오프라인 | vite-plugin-pwa (서비스 워커, 매니페스트) |
| 차트 | 직접 SVG (외부 차트 라이브러리 없음) |

## 3. 구조

```
src/
  core/                  순수 TS, DOM·Dexie 의존 없음
    model.ts             도메인 타입
    money.ts             원 단위 정수 처리, 포맷
    dates.ts             기기 시간대 기준 날짜/월 키
    parser/              알림 → ParseResult
      formats/*.ts       형식별 규칙 (id, version, appliesTo, parse)
      index.ts           parseNotification()
    dedup/               동일 알림 키, 교차 출처 중복 판별
    refund/              원거래 매칭, 누적 환불 검증
    pipeline/ingest.ts   ingestNotification() — 단일 진입점
    budget/              순지출·남은 예산·카테고리·월 추이 계산
    repo.ts              저장소 인터페이스 (Repo)
  data/
    dexieRepo.ts         Repo 구현 (IndexedDB)
    memoryRepo.ts        Repo 구현 (테스트용)
    crypto.ts            Web Crypto AES-GCM 발췌 암호화, 기기 키
    seed.ts              기본 카테고리·결제수단
  ui/
    App.tsx, routes, 화면 컴포넌트, 공용 컴포넌트
```

**경계 규칙:** `core/`는 `Repo` 인터페이스와 `Clock`(현재 시각), `Crypto`(암호화) 인터페이스만 주입받는다. UI는 `core/` 함수와 `Repo`를 통해서만 데이터에 접근한다.

## 4. 도메인 모델

금액은 모두 **원 단위 정수**.

- **Transaction**: id, type(`expense|income|transfer`), amount, date(YYYY-MM-DD, 기기 시간대), time?(HH:mm), merchant?, categoryId, paymentMethodId, toPaymentMethodId?(이체 도착), memo?, recordMethod(`manual|auto|confirmed`), dateFromReceipt(boolean, 수신 시각 사용 여부), userEdited(boolean), approvalNo?, createdAt, updatedAt
- **Refund**: id, originalTxId, amount, date, sourceRecordId?, createdAt
- **Candidate** (확인함): id, kind(`approval|cancel`), extracted(부분 추출값), uncertainFields[], reasons[](`missing_field|unsupported_format|duplicate_suspect|refund_unmatched|refund_ambiguous|refund_exceeds|date_uncertain|review_mode`), duplicateOfTxId?, refundCandidateTxIds?, encryptedExcerpt, status(`pending|confirmed|ignored`), createdAt, expiresAt(생성+30일)
- **NotificationRecord** (처리 기록): id, sourceApp, notificationKey, receivedAt, dedupFingerprint, ruleId, ruleVersion, outcome(`saved|merged|candidate|ignored_non_tx|refund_linked`), linkedTxId?, linkedCandidateId?, linkedRefundId?
- **Transaction ↔ 출처**: NotificationRecord.linkedTxId로 한 거래에 여러 출처 연결
- **Category / PaymentMethod**: id, name, kind(카테고리: expense|income, 수단: card|cash|account|pay), sortOrder, archived; PaymentMethod는 matchKeys[](알림의 카드명·끝자리 매핑)
- **Budget**: month(YYYY-MM), total
- **AutoRecordSettings**: enabled, allowedSources[](`{app, sender?}`), saveMode(`auto|review_all`), lastProcessedAt?
- **AppSettings**: pinHash?, lockEnabled

### 4.1 지원 알림 형식 (가상)

| ruleId | 출처 앱 | 예시 |
|---|---|---|
| `sms-card-a` | sms | `[Web발신] 가나카드(1234)승인 홍*동 12,000원 일시불 10/15 12:30 스타벅스 누적 345,000원` |
| `sms-card-a-cancel` | sms | `[Web발신] 가나카드(1234)취소 홍*동 12,000원 10/15 13:10 스타벅스` |
| `sms-card-b` | sms | `다라카드 승인 5678 8,500원 10/15 08:12 GS25역삼점 승인번호 12345678` |
| `kakao-card-a` | kakaotalk | `가나카드 결제 승인\n금액: 12,000원\n가맹점: 스타벅스\n일시: 10/15 12:30\n카드: 가나(1234)` |
| `pay-app-a` | payapp | `마바페이 결제 완료 12,000원 · 스타벅스 · 10월 15일 12:30` |

- 할부(`3개월` 등), 외화(`USD` 등)가 포함되면 추출하되 **항상 확인함**.
- 비거래 판별: 광고(`(광고)`, `할인`, `이벤트`), 인증번호(`인증번호`), 한도·잔액·청구 예정 안내, 카드대금 납부·결제대금 출금 → `ignored_non_tx`.
- 형식 불일치지만 금액 패턴 + 승인/결제/취소 키워드가 있으면 **거래성 알림**으로 보고 `unsupported_format` 후보.

## 5. 처리 파이프라인 — `ingestNotification(input, deps)`

입력: `{ sourceApp, sender?, text, receivedAt, notificationKey }`

1. **수집 대상 확인**: 자동 기록 꺼짐 또는 허용 목록 외 → 원문 폐기, 기록 없음, 결과 `dropped`. (붙여넣기 분석은 사용자가 직접 넣은 것이므로 허용 목록 검사를 건너뛰고 항상 확인함으로 보냄)
2. **동일 알림 확인**: `(sourceApp, notificationKey)` 처리 기록이 있으면 기존 결과 반환. 무시·삭제된 거래도 기록이 남아 있어 재생성 안 됨.
3. **분석**: 형식 순회 → `non_tx | tx(확실/불확실 필드 포함)`.
4. **결제수단 매핑**: 카드명·끝자리를 PaymentMethod.matchKeys와 비교. 실패 → `missing_field(paymentMethod)`.
5. **거래 시각**: 알림에 시각이 있으면 사용(연도는 수신 시각 기준, 수신보다 미래면 전년). 없으면 수신 시각 + `dateFromReceipt`. 명시 시각과 수신 시각 차이가 24시간 초과 → `date_uncertain`.
6. **중복 검사(승인)**: 다른 출처 기록이 연결된 거래 중
   - 확실한 중복: 결제수단·금액·가맹점(정규화) 일치, 시각 차 ≤ 2분, 승인번호가 양쪽에 있으면 일치 → 새 거래 없이 출처 추가(`merged`). 사용자 수정 거래도 출처만 추가.
   - 애매: 금액 일치 + 시각 차 ≤ 2분이지만 가맹점 또는 수단이 불일치·미확인 → `duplicate_suspect` 후보.
   - **같은 출처 앱**의 서로 다른 알림 키는 교차 중복 대상이 아님(실제 연속 결제 보호).
7. **취소·환불**: 같은 수단 + 같은 가맹점 + 90일 이내 + 잔여 환불 가능액 ≥ 환불액인 지출 거래 검색.
   - 정확히 1건 → Refund 생성(`refund_linked`)
   - 0건 → `refund_unmatched`, 여러 건 → `refund_ambiguous`, 누적 초과 → `refund_exceeds` 후보
   - 같은 취소가 다른 출처로 다시 오면 같은 원거래·금액·시각 ±2분의 Refund에 출처만 추가.
8. **저장**: saveMode=`auto`이고 불확실 사유 없음 → 거래 저장(`auto`). 카테고리 미확인은 '미분류'로 저장 가능. 그 외 → 후보(`review_mode` 포함).
9. 처리 기록 저장, `lastProcessedAt` 갱신.

**실패 처리:** 3~8 중 저장 오류 시 입력을 `pendingQueue`(IndexedDB)에 보관하고 앱 시작 시 재처리. 오류 로그에는 ruleId·오류 종류만 남기고 금액·가맹점·원문은 남기지 않는다.

### 5.1 확인함 동작
- 후보 저장 → 거래 생성(`confirmed`), 처리 기록 연결, 발췌 삭제.
- 무시 → status `ignored`, 발췌 삭제. 처리 기록은 남아 재전달 시 재등장하지 않음.
- 중복 후보 → "기존 거래와 같음(출처 추가)" / "별도 거래로 저장" 선택.
- 환불 후보 → 원거래 직접 선택 후 연결.
- 앱 시작 시 `expiresAt` 지난 pending 후보 삭제.

### 5.2 사용자 수정 보호
- 사용자가 자동 기록 거래를 수정하면 `userEdited=true`; 후속 알림은 출처만 추가.
- 자동 기록 거래 삭제 시 처리 기록은 유지(linkedTxId만 null)되어 동일 알림 재생성 방지.
- 수집 대상에서 앱을 빼도 기존 거래 유지.

## 6. 계산 규칙 (`core/budget`)

- 월 순지출 = Σ(해당 월 지출) − Σ(해당 월 날짜의 환불). 환불은 환불일 기준 월.
- 이체는 수입·지출 합계 제외. 카드대금 납부 알림은 거래로 만들지 않음.
- 남은 예산 = 월 예산 − 월 순지출. 사용률 = 순지출 / 예산 (예산 없음 → 안내 표시).
- 카테고리별 소비 = 해당 월 카테고리 지출 − 해당 월 날짜의 환불 중 원거래가 그 카테고리인 금액. (환불은 원거래 월이 아니라 환불일 월에서 원거래 카테고리로 차감)
- 확인함 후보는 어떤 합계에도 포함하지 않음.
- 순지출 ≤ 0인 달은 비중 차트 대신 금액 표시.

## 7. 화면

하단 탭: 홈 · 내역 · 통계 · 설정. 상태는 색상과 텍스트를 함께 표시하고, 모든 입력은 label과 연결.

| 화면 | 내용 |
|---|---|
| 홈 | 월 순지출, 남은 예산·사용률(막대+수치), 최근 5건, 자동 기록 상태, "확인 필요 N건", + 버튼 |
| 확인함 | 후보 목록·사유, 수정→저장/무시, 중복 비교, 환불 원거래 선택 |
| 거래 입력·상세 | 금액·유형·날짜·가맹점·카테고리·수단(이체는 출발/도착)·메모, 저장 중복 탭 방지, 출처 알림·연결 환불 표시, 수정·삭제 |
| 내역 | 월 이동, 날짜별 그룹, 검색(메모·가맹점), 필터(유형·카테고리·수단·기록 방식), 삭제 후 5초 실행 취소 |
| 통계 | 6개월 추이, 카테고리별 소비, 전월 대비 |
| 설정 | 월 예산, 카테고리·결제수단(추가·수정·보관), 자동 기록 설정, 붙여넣기 분석, 알림 시뮬레이터, PIN 잠금, CSV 내보내기(UTF-8 BOM), 전체 삭제, 기기 내 저장 안내 |
| 자동 기록 설정 | 권한 상태(웹 모의: 허용/거절/해제), 켜기/끄기, 허용 출처·발신자, 저장 모드(변경은 이후 알림부터), 마지막 처리 시각, 지원 형식 목록 |
| 알림 시뮬레이터 | 출처 앱·발신자·알림 키 선택, 샘플 프리셋(승인, 문자+카톡 중복, 연속 결제, 전액 취소, 부분 환불, 광고, 인증번호), 결과(outcome) 표시 |
| 첫 실행 | 자동 기록 설명 → 설정 또는 건너뛰기 → 예산 설정 또는 건너뛰기 → 홈 |

## 8. 개인정보

- 모든 데이터는 기기 IndexedDB. 네트워크 전송 없음.
- 후보 발췌는 AES-GCM 암호화. 키는 non-extractable CryptoKey로 IndexedDB에 저장.
- 전체 삭제: 모든 테이블·키·pendingQueue 삭제 후 첫 실행 상태로.
- PIN은 PBKDF2 해시로 저장. 잠금은 앱 실행·백그라운드 복귀 시.

## 9. 테스트

Vitest, `memoryRepo` 사용.

- 파서: 형식별 승인·취소 추출, 할부·외화 → 확인함 플래그, 광고·인증번호·한도·카드대금 → non_tx, 미지원 거래성 알림 → unsupported
- 파이프라인: 문자+카톡 동일 결제 1건, 같은 출처 연속 결제 2건, 동일 알림 재전달 1회 처리, 무시·삭제 후 재전달 미생성, 사용자 수정 미덮어쓰기, 저장 모드 review_all, 허용 목록 외 폐기, 자동 기록 꺼짐
- 환불: 전액 취소, 부분 환불 2회, 누적 초과 → 확인함, 원거래 없음/복수 → 확인함, 취소 중복 알림 1회 반영
- 계산: 이체 제외, 환불일 월 차감, 월말/월초 경계, 후보 제외, 예산 없음
- UI: 개발 서버로 주요 흐름 수동 확인

## 10. 안드로이드 이전 메모

- `core/` 그대로 사용. `Repo`를 SQLite(expo-sqlite) 구현으로 교체.
- NotificationListenerService(Kotlin)에서 `{sourceApp, text, postTime, key}`를 JS로 전달해 `ingestNotification` 호출.
- 시뮬레이터 프리셋은 안드로이드 회귀 테스트 데이터로 재사용.
