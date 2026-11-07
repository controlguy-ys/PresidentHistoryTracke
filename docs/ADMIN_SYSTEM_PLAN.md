# 공약 관리 및 뉴스 시스템 계획

## 📊 현재 상황

### 문제점
- 공약이 1~2개만 있는 후보자 발견 (총 5명)
  - 강승규 (홍성군예산군) - 1개
  - 김원이 (목포시) - 1개
  - 백혜련 (수원시을) - 1개
  - 노종면 (부평구갑) - 1개
  - 이재정 (안양시동안구을) - 1개
- 공약별 관련 뉴스 기능 없음

## 🎯 목표

1. **공약 데이터 관리**
   - 공약 추가/수정/삭제
   - 공약 상태 업데이트
   - 공약 진행률 관리

2. **뉴스 연동**
   - 공약별 관련 뉴스 추가
   - 뉴스 자동/수동 수집
   - 뉴스 링크 및 요약 표시

---

## 📐 데이터베이스 스키마 확장

### 1. pledge_news 테이블 (신규)

```sql
CREATE TABLE pledge_news (
    news_id INTEGER PRIMARY KEY AUTOINCREMENT,
    pledge_id INTEGER NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    source VARCHAR(100),          -- 출처 (한겨레, 조선일보, etc.)
    published_date TIMESTAMP,
    summary TEXT,                 -- 뉴스 요약
    sentiment VARCHAR(20),        -- positive/neutral/negative
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),      -- admin 또는 bot
    FOREIGN KEY (pledge_id) REFERENCES pledges(pledge_id) ON DELETE CASCADE
);

CREATE INDEX idx_pledge_news_pledge_id ON pledge_news(pledge_id);
CREATE INDEX idx_pledge_news_published_date ON pledge_news(published_date DESC);
```

### 2. admin_users 테이블 (신규)

```sql
CREATE TABLE admin_users (
    user_id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'editor',  -- admin, editor, viewer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

### 3. audit_log 테이블 (신규)

```sql
CREATE TABLE audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id UUID,
    action VARCHAR(50) NOT NULL,      -- CREATE, UPDATE, DELETE
    table_name VARCHAR(50) NOT NULL,  -- pledges, pledge_news
    record_id INTEGER,
    old_value TEXT,
    new_value TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES admin_users(user_id)
);
```

---

## 🛠 구현 방안

### Option 1: Supabase Admin (추천)
**장점:**
- Supabase Auth로 인증 처리
- Row Level Security로 권한 관리
- Realtime으로 자동 업데이트
- API 자동 생성

**구현 순서:**
1. Supabase에 새 테이블 생성 (`pledge_news`, `admin_users`, `audit_log`)
2. RLS 정책 설정 (admin만 수정 가능)
3. Admin Dashboard UI 구현
4. Supabase Auth 연동

### Option 2: 직접 Admin API 구현
**장점:**
- 완전한 제어
- 커스텀 로직 가능

**단점:**
- 개발 시간 증가
- 보안 직접 관리

---

## 🎨 Admin Dashboard UI 설계

### 1. 공약 관리 페이지

```
┌─────────────────────────────────────────────────┐
│ Admin Dashboard - 공약 관리                      │
├─────────────────────────────────────────────────┤
│ [검색] [필터: 후보자/지역/정당] [공약 1개 후보만] │
├─────────────────────────────────────────────────┤
│ 강승규 (홍성군예산군) - 국민의힘                  │
│ ├─ 공약 1개 ⚠️                                   │
│ └─ [공약 추가] [공약 수정]                        │
├─────────────────────────────────────────────────┤
│ 김원이 (목포시) - 더불어민주당                    │
│ ├─ 공약 1개 ⚠️                                   │
│ └─ [공약 추가] [공약 수정]                        │
└─────────────────────────────────────────────────┘
```

### 2. 공약 상세 편집 모달

```
┌─────────────────────────────────────────────┐
│ 공약 편집                          [X]       │
├─────────────────────────────────────────────┤
│ 제목: [_____________________________]       │
│ 분야: [선택: 교육/복지/교통/...]            │
│ 내용: [___________________________          │
│        ___________________________]         │
│ 상태: [○ 준비중 ○ 진행중 ○ 완료]           │
│ 진행률: [■■■■■□□□□□] 50%                │
│                                             │
│ 관련 뉴스:                                  │
│ ┌─────────────────────────────┐            │
│ │ + 뉴스 추가                  │            │
│ │ - [삭제] "관련 뉴스 제목..."  │            │
│ │   출처: 한겨레 | 2025-10-01  │            │
│ └─────────────────────────────┘            │
│                                             │
│          [취소]  [저장]                     │
└─────────────────────────────────────────────┘
```

### 3. 뉴스 추가 폼

```
┌─────────────────────────────────────────────┐
│ 관련 뉴스 추가                     [X]       │
├─────────────────────────────────────────────┤
│ 제목: [_____________________________]       │
│ URL:  [_____________________________]       │
│ 출처: [한겨레 ▼]                            │
│ 날짜: [2025-10-06]                          │
│ 요약: [___________________________          │
│        ___________________________]         │
│ 감정: [○ 긍정 ○ 중립 ○ 부정]              │
│                                             │
│ [뉴스 URL에서 자동 추출] 버튼               │
│                                             │
│          [취소]  [추가]                     │
└─────────────────────────────────────────────┘
```

---

## 🤖 뉴스 자동 수집 (Phase 2)

### 방법 1: RSS Feed
- 주요 언론사 RSS 구독
- 키워드 기반 필터링 (공약 제목, 후보자명)
- 정기적 크롤링 (Vercel Cron Jobs)

### 방법 2: Google News API
- Google Custom Search API 사용
- 공약 키워드로 검색
- 일일 쿼터 제한 고려

### 방법 3: Supabase Edge Functions
```javascript
// Supabase Edge Function
export async function collectNews(pledgeId, keywords) {
  const searchQuery = keywords.join(' OR ');
  const newsResults = await fetch(
    `https://newsapi.org/v2/everything?q=${searchQuery}&language=ko`
  );

  const { articles } = await newsResults.json();

  for (const article of articles) {
    await supabase.from('pledge_news').insert({
      pledge_id: pledgeId,
      title: article.title,
      url: article.url,
      source: article.source.name,
      published_date: article.publishedAt,
      summary: article.description,
      created_by: 'bot'
    });
  }
}
```

---

## 📅 구현 로드맵

### Phase 1: 기본 관리 기능 (우선)
1. ✅ 공약 1개 후보자 확인
2. ✅ Supabase에 `pledge_news`, `admin_users`, `audit_log` 테이블 SQL 작성
3. ✅ Admin 전용 페이지 라우팅 (`/admin`)
4. ✅ Admin Dashboard UI 기본 구조 생성
5. ✅ SupabaseDataSource에 공약/뉴스 CRUD 메서드 추가
6. [ ] Supabase에서 SQL 실행 (테이블 생성)
7. [ ] Supabase Auth 로그인 구현
8. [ ] 공약 편집 모달 UI 구현
9. [ ] 뉴스 추가 모달 UI 구현
10. [ ] 공약 추가 기능 구현

**예상 소요 시간**: 6-8시간
**진행 상황**: 5/10 완료 (2025-10-06)

### Phase 2: 뉴스 자동 수집 (선택)
1. [ ] 뉴스 API 연동
2. [ ] Supabase Edge Function으로 크롤러 구현
3. [ ] Vercel Cron Jobs로 정기 실행

**예상 소요 시간**: 4-6시간

### Phase 3: 고급 기능 (선택)
1. [ ] 감정 분석 (AI)
2. [ ] 뉴스 요약 자동 생성
3. [ ] 중복 뉴스 필터링

**예상 소요 시간**: 8-10시간

---

## 🔐 보안 고려사항

1. **인증**
   - Supabase Auth (이메일/비밀번호)
   - Admin 전용 이메일 화이트리스트

2. **권한 관리**
   - RLS 정책으로 admin만 수정 가능
   - viewer는 읽기 전용

3. **감사 로그**
   - 모든 변경사항 기록
   - 누가, 언제, 무엇을 변경했는지 추적

---

## 💡 다음 단계

**✅ 완료된 작업 (2025-10-06):**

1. ✅ 공약 1개 후보자 5명 확인
2. ✅ `scripts/create_admin_tables.sql` 작성 (pledge_news, admin_users, audit_log)
3. ✅ Admin 페이지 라우팅 추가 (App.jsx)
4. ✅ AdminDashboard 컴포넌트 생성 (src/pages/AdminDashboard.jsx)
5. ✅ SupabaseDataSource에 CRUD 메서드 추가:
   - createPledge, updatePledge, deletePledge
   - getNewsByPledge, createNews, updateNews, deleteNews, getAllNews

**⏭️ 다음 작업:**

1. **Supabase에서 SQL 실행**
   - Supabase SQL Editor 열기
   - `scripts/create_admin_tables.sql` 내용 복사
   - 실행하여 테이블 생성

2. **공약 편집 모달 구현**
   - PledgeEditModal 컴포넌트 생성
   - 공약 제목, 내용, 분야, 상태 편집

3. **뉴스 추가 모달 구현**
   - NewsAddModal 컴포넌트 생성
   - 뉴스 제목, URL, 출처, 날짜, 요약 입력

4. **공약 1개 후보자 데이터 수정**
   - Admin Dashboard에서 각 후보자별로 공약 추가

**선택한 방식: A) Supabase Admin Dashboard 구현 ✅**
