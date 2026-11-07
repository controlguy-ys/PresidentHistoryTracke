# Changelog

## [1.1.0] - 2025-10-06

### 🌟 Added
- **사용자 평가 시스템 기획 완료**
  - `docs/USER_RATING_SYSTEM_PLAN.md` 작성
  - 5개 데이터베이스 테이블 설계 (candidate_ratings, pledge_ratings, rating_likes, rating_reports, user_profiles)
  - Google OAuth 2.0 인증 계획
  - UI/UX 목업 및 5단계 구현 로드맵

- **Admin Dashboard 기본 구현**
  - `src/pages/AdminDashboard.jsx` 생성
  - 후보자 목록 및 필터링 UI
  - 공약 수 통계 대시보드
  - 공약 1개 후보자 하이라이트 기능

- **Admin 시스템 데이터베이스 스키마**
  - `scripts/create_admin_tables.sql` 작성
  - pledge_news, admin_users, audit_log 테이블
  - RLS 정책 및 인덱스 정의

- **SupabaseDataSource CRUD 메서드**
  - 공약 관리: createPledge, updatePledge, deletePledge
  - 뉴스 관리: createNews, updateNews, deleteNews, getNewsByPledge, getAllNews

- **문서화**
  - `docs/ADMIN_SYSTEM_PLAN.md` - Admin 시스템 상세 계획
  - `docs/USER_RATING_SYSTEM_PLAN.md` - 평가 시스템 상세 계획
  - `docs/DEVELOPMENT_STATUS.md` - 전체 개발 현황 요약

### 🚀 Performance
- **Phase 5.2: 성능 최적화 완료**
  - React.lazy() 코드 스플리팅 (OfficialsList, OfficialDetail)
  - React.memo() 적용 (불필요한 리렌더링 방지)
  - source-map-explorer 번들 분석 도구 추가

### 📈 SEO
- **Phase 5.3: SEO 최적화 완료**
  - Meta tags 개선 (Open Graph, Twitter Card)
  - JSON-LD 구조화된 데이터
  - robots.txt 생성
  - sitemap.xml 생성 (17개 지역 페이지)

### 🔄 Changed
- **App.jsx** - Admin 페이지 라우팅 추가 (Settings 아이콘)
- **ROADMAP.md** - Phase 6 (사용자 평가 시스템) 추가
- **README.md**
  - Phase 6, 7 진행 상황 반영
  - 프로젝트 구조 업데이트 (pages/, docs/ 반영)

### 📊 Data
- **데이터 품질 이슈 발견**: 공약 1개만 있는 후보자 5명 확인
  - 강승규 (홍성군예산군)
  - 김원이 (목포시)
  - 백혜련 (수원시을)
  - 노종면 (부평구갑)
  - 이재정 (안양시동안구을)

### 📝 Documentation
- 문서 구조 정리 (docs/ 폴더로 이동)
- DEVELOPMENT_STATUS.md 추가 (전체 현황 요약)

---

## [1.0.0] - 2025-10-05 - Supabase Migration Complete

### 🚀 Deployed
- **Vercel 배포 완료**: https://korea-promise-tracker.vercel.app
- 환경 변수 설정 (REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY)

### 🗄️ Database
- **Supabase PostgreSQL 완전 마이그레이션**
  - 254명 후보자 데이터
  - 7,414개 공약 데이터
  - candidates, pledges 테이블
- **SupabaseDataSource 구현**
  - 모든 CRUD 메서드 완성
  - RLS 정책 설정 준비

### 📂 Architecture
- **DataSource 추상화 패턴**
  - IElectionDataSource 인터페이스
  - LocalDBDataSource (SQLite)
  - SupabaseDataSource (PostgreSQL)
- **환경 변수 기반 전환**
  - REACT_APP_USE_SUPABASE=true/false

---

## 2025-10-05 - Database Integration Complete

### 주요 변경사항

#### 1. 데이터베이스 통합
- **LocalDBDataSource 구현 완료**
  - `sql.js`를 사용한 브라우저 내 SQLite DB 지원
  - `public/data/election_data.db` 경로에 DB 파일 배치
  - 모든 CRUD 메서드 구현 (getAllWinners, getPledgesByCandidate, getAllPledges 등)

#### 2. Context API 구조
- **ElectionDataContext 생성**
  - 전역 데이터 소스 관리
  - 로딩/에러 상태 처리
  - 환경변수 기반 데이터 소스 선택 (LocalDB/Supabase)

#### 3. Custom Hooks 추가
- **useDBPromises**: DB에서 공약 데이터 가져오기 및 변환
- **useDBOfficials**: 당선자 정보 및 통계 로드
- **useDBRegions**: 지역별 데이터 및 정당 통계 집계

#### 4. 데이터 변환 레이어
- **officials.js**: DB candidate → UI official 변환
- **promises.js**: DB pledges → UI promises 변환
- **regions.js**: 정적 region 메타데이터 제공

#### 5. 버그 수정
- React Hook 순서 에러 해결 (useMemo를 조건부 return 이전으로 이동)
- Context destructuring 수정 (모든 hooks에서 `{ dataSource }` 형태로 수정)
- DB 파일 경로 문제 해결 (data/ → public/data/)

### 파일 구조 변경

```
src/
├── contexts/
│   └── ElectionDataContext.jsx    [NEW] 데이터 소스 Context
├── hooks/
│   ├── useDBPromises.js           [NEW] 공약 데이터 hook
│   ├── useDBOfficials.js          [NEW] 당선자 데이터 hook
│   └── useDBRegions.js            [NEW] 지역 데이터 hook
├── services/
│   ├── IElectionDataSource.js     [기존] 인터페이스
│   └── LocalDBDataSource.js       [수정] getAllPledges 메서드 추가
├── data/
│   ├── officials.js               [NEW] 변환 함수
│   ├── promises.js                [NEW] 변환 함수
│   ├── regions.js                 [NEW] 정적 메타데이터
│   ├── officials.json.backup      [백업]
│   ├── promises.js.backup         [백업]
│   └── promises.json.backup       [백업]
└── App.jsx                        [수정] DB hooks 통합

public/
└── data/
    └── election_data.db           [NEW] SQLite 데이터베이스 파일
```

### 기술 스택
- React 18.2.0
- sql.js (SQLite in browser)
- Context API + Custom Hooks
- Tailwind CSS

### 다음 단계
- [ ] Supabase 데이터 소스 구현
- [ ] 공약 상세 페이지 개선
- [ ] 검색 성능 최적화
- [ ] 데이터 캐싱 전략

### 알려진 이슈
- 없음 (현재 버전에서 모든 주요 기능 정상 작동)

---

## 이전 버전

### 2025-10-04
- 웹팩 5 폴리필 에러 수정
- Dark mode 지원 추가
- 지도 클러스터링 및 팝업 선택 기능
