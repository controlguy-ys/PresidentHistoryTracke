# Supabase 마이그레이션 가이드

## 📋 목차
1. [현재 시스템 분석](#현재-시스템-분석)
2. [Supabase 설정](#supabase-설정)
3. [데이터베이스 스키마 마이그레이션](#데이터베이스-스키마-마이그레이션)
4. [프론트엔드 코드 변경](#프론트엔드-코드-변경)
5. [배포 및 테스트](#배포-및-테스트)

---

## 1. 현재 시스템 분석

### 현재 기술 스택
- **데이터베이스**: SQLite (sql.js - 브라우저 기반)
- **데이터 소스**: `LocalDBDataSource.js`
- **데이터베이스 파일**: `public/data/election_data.db`

### 현재 데이터 구조

#### Candidates 테이블
```sql
CREATE TABLE Candidates (
    hubo_id TEXT PRIMARY KEY,
    name TEXT,
    sgg_name TEXT,
    party_name TEXT,
    votes_won INTEGER,
    vote_percentage REAL,
    age INTEGER,
    gender TEXT,
    job TEXT,
    edu TEXT,
    career1 TEXT,
    career2 TEXT,
    metro_city TEXT,
    is_winner INTEGER
);
```

#### Pledges 테이블
```sql
CREATE TABLE Pledges (
    pledge_id INTEGER PRIMARY KEY,
    hubo_id TEXT,
    pledge_order INTEGER,
    category TEXT,
    title TEXT,
    content TEXT,
    status TEXT,
    FOREIGN KEY (hubo_id) REFERENCES Candidates(hubo_id)
);
```

### 현재 주요 기능
1. **지역별 공약 조회**: 광역시/도 선택 → 국회의원 리스트 → 공약 상세
2. **인물별 공약 조회**: 국회의원 검색/필터 → 공약 상세
3. **실시간 필터링**: 정당, 검색어, 카테고리별 필터
4. **페이지네이션**: 10명씩 표시

---

## 2. Supabase 설정

### Step 1: Supabase 프로젝트 생성
1. https://supabase.com 접속
2. "New Project" 클릭
3. 프로젝트 이름: `korea-promise-tracker`
4. Database Password 설정 (강력한 비밀번호 사용)
5. Region: `Northeast Asia (Seoul)` 선택 (한국 사용자용)

### Step 2: 환경 변수 설정
```bash
# .env.local 파일 생성
REACT_APP_SUPABASE_URL=your-project-url
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

### Step 3: Supabase 클라이언트 설치
```bash
npm install @supabase/supabase-js
```

---

## 3. 데이터베이스 스키마 마이그레이션

### Step 1: Supabase SQL Editor에서 테이블 생성

```sql
-- Candidates 테이블
CREATE TABLE candidates (
    hubo_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sgg_name TEXT,
    party_name TEXT,
    votes_won INTEGER,
    vote_percentage REAL,
    age INTEGER,
    gender TEXT,
    job TEXT,
    edu TEXT,
    career1 TEXT,
    career2 TEXT,
    metro_city TEXT,
    is_winner BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Pledges 테이블
CREATE TABLE pledges (
    pledge_id SERIAL PRIMARY KEY,
    hubo_id TEXT REFERENCES candidates(hubo_id) ON DELETE CASCADE,
    pledge_order INTEGER,
    category TEXT,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_candidates_metro_city ON candidates(metro_city);
CREATE INDEX idx_candidates_is_winner ON candidates(is_winner);
CREATE INDEX idx_candidates_party ON candidates(party_name);
CREATE INDEX idx_pledges_hubo_id ON pledges(hubo_id);
CREATE INDEX idx_pledges_status ON pledges(status);
CREATE INDEX idx_pledges_category ON pledges(category);

-- Full Text Search 인덱스 (검색 최적화)
ALTER TABLE candidates ADD COLUMN search_vector tsvector;
CREATE INDEX idx_candidates_search ON candidates USING GIN(search_vector);

-- 검색 벡터 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION candidates_search_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('korean', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('korean', COALESCE(NEW.sgg_name, '')), 'B') ||
        setweight(to_tsvector('korean', COALESCE(NEW.party_name, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_search_vector_update
    BEFORE INSERT OR UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION candidates_search_update();

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_candidates_updated_at
    BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pledges_updated_at
    BEFORE UPDATE ON pledges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Step 2: Row Level Security (RLS) 설정

```sql
-- RLS 활성화
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;

-- 읽기 전용 정책 (모든 사용자가 읽을 수 있음)
CREATE POLICY "Public candidates are viewable by everyone"
    ON candidates FOR SELECT
    USING (true);

CREATE POLICY "Public pledges are viewable by everyone"
    ON pledges FOR SELECT
    USING (true);

-- 관리자만 수정 가능 (나중에 admin role 추가 시)
-- CREATE POLICY "Only admins can modify candidates"
--     ON candidates FOR ALL
--     USING (auth.jwt() ->> 'role' = 'admin');
```

### Step 3: 데이터 마이그레이션 스크립트

```javascript
// scripts/migrate_to_supabase.js
const { createClient } = require('@supabase/supabase-js');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key (not anon key)
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateData() {
    try {
        console.log('Loading SQLite database...');
        const SQL = await initSqlJs();
        const dbBuffer = fs.readFileSync(path.join(__dirname, '../data/election_data.db'));
        const db = new SQL.Database(dbBuffer);

        // Migrate Candidates
        console.log('Migrating candidates...');
        const candidates = db.exec('SELECT * FROM Candidates WHERE is_winner = 1');

        if (candidates.length > 0) {
            const candidateData = candidates[0].values.map(row => {
                const obj = {};
                candidates[0].columns.forEach((col, idx) => {
                    obj[col] = row[idx];
                });
                return obj;
            });

            const { data, error } = await supabase
                .from('candidates')
                .upsert(candidateData);

            if (error) throw error;
            console.log(`✓ Migrated ${candidateData.length} candidates`);
        }

        // Migrate Pledges
        console.log('Migrating pledges...');
        const pledges = db.exec(`
            SELECT p.* FROM Pledges p
            JOIN Candidates c ON p.hubo_id = c.hubo_id
            WHERE c.is_winner = 1
        `);

        if (pledges.length > 0) {
            const pledgeData = pledges[0].values.map(row => {
                const obj = {};
                pledges[0].columns.forEach((col, idx) => {
                    obj[col] = row[idx];
                });
                return obj;
            });

            // Batch insert (Supabase has a limit of 1000 rows per request)
            const batchSize = 1000;
            for (let i = 0; i < pledgeData.length; i += batchSize) {
                const batch = pledgeData.slice(i, i + batchSize);
                const { error } = await supabase
                    .from('pledges')
                    .upsert(batch);

                if (error) throw error;
                console.log(`✓ Migrated pledges ${i + 1} to ${Math.min(i + batchSize, pledgeData.length)}`);
            }
        }

        console.log('✅ Migration completed successfully!');
        db.close();

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateData();
```

**실행 방법:**
```bash
# .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_KEY 추가
node scripts/migrate_to_supabase.js
```

---

## 4. 프론트엔드 코드 변경

### Step 1: Supabase 클라이언트 설정

```javascript
// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Step 2: SupabaseDataSource 생성

```javascript
// src/services/SupabaseDataSource.js
import { supabase } from './supabaseClient';

class SupabaseDataSource {
    /**
     * Get all winners
     */
    async getAllWinners() {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('is_winner', true)
            .order('name');

        if (error) throw error;
        return data;
    }

    /**
     * Get candidate by ID
     */
    async getCandidateById(huboId) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('hubo_id', huboId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Get pledges by candidate
     */
    async getPledgesByCandidate(huboId) {
        const { data, error } = await supabase
            .from('pledges')
            .select('*')
            .eq('hubo_id', huboId)
            .order('pledge_order');

        if (error) throw error;
        return data;
    }

    /**
     * Get all pledges with candidate info
     */
    async getAllPledges() {
        const { data, error } = await supabase
            .from('pledges')
            .select(`
                *,
                candidates (
                    name,
                    sgg_name,
                    party_name
                )
            `)
            .order('pledge_order');

        if (error) throw error;
        return data;
    }

    /**
     * Get pledge statistics for a candidate
     */
    async getPledgeStatistics(huboId) {
        const { data, error } = await supabase
            .from('pledges')
            .select('status')
            .eq('hubo_id', huboId);

        if (error) throw error;

        const stats = {
            total: data.length,
            completed: data.filter(p => p.status === 'completed').length,
            inProgress: data.filter(p => p.status === 'in_progress').length,
            pending: data.filter(p => p.status === 'pending').length,
            suspended: data.filter(p => p.status === 'suspended').length
        };

        return stats;
    }

    /**
     * Search candidates (uses Full Text Search)
     */
    async searchCandidates(searchTerm) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .textSearch('search_vector', searchTerm)
            .eq('is_winner', true);

        if (error) throw error;
        return data;
    }

    /**
     * Get candidates by metro city
     */
    async getCandidatesByMetroCity(metroCity) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('metro_city', metroCity)
            .eq('is_winner', true)
            .order('name');

        if (error) throw error;
        return data;
    }

    /**
     * Get candidates by party
     */
    async getCandidatesByParty(party) {
        const { data, error } = await supabase
            .from('candidates')
            .select('*')
            .eq('party_name', party)
            .eq('is_winner', true)
            .order('name');

        if (error) throw error;
        return data;
    }
}

export default SupabaseDataSource;
```

### Step 3: Context Provider 수정

```javascript
// src/contexts/ElectionDataContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import SupabaseDataSource from '../services/SupabaseDataSource';

const ElectionDataContext = createContext();

export const useElectionData = () => {
    const context = useContext(ElectionDataContext);
    if (!context) {
        throw new Error('useElectionData must be used within ElectionDataProvider');
    }
    return context;
};

export const ElectionDataProvider = ({ children }) => {
    const [dataSource] = useState(() => new SupabaseDataSource());
    const [isReady, setIsReady] = useState(true); // Supabase는 즉시 사용 가능

    return (
        <ElectionDataContext.Provider value={{ dataSource, isReady }}>
            {children}
        </ElectionDataContext.Provider>
    );
};
```

### Step 4: Custom Hooks 수정 (예시)

```javascript
// src/hooks/useDBOfficials.js
import { useState, useEffect } from 'react';
import { useElectionData } from '../contexts/ElectionDataContext';
import { transformCandidatesToOfficials } from '../data/officials';

export const useDBOfficials = () => {
    const { dataSource, isReady } = useElectionData();
    const [officials, setOfficials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!isReady) return;

        const loadOfficials = async () => {
            try {
                setLoading(true);
                const candidates = await dataSource.getAllWinners();
                const officialsData = await transformCandidatesToOfficials(dataSource, candidates);
                setOfficials(officialsData);
                setError(null);
            } catch (err) {
                console.error('Failed to load officials:', err);
                setError(err);
            } finally {
                setLoading(false);
            }
        };

        loadOfficials();
    }, [dataSource, isReady]);

    return { officials, loading, error };
};
```

### Step 5: 실시간 업데이트 추가 (선택사항)

```javascript
// src/hooks/useRealtimeOfficials.js
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export const useRealtimeOfficials = () => {
    const [officials, setOfficials] = useState([]);

    useEffect(() => {
        // Initial load
        const loadOfficials = async () => {
            const { data } = await supabase
                .from('candidates')
                .select('*')
                .eq('is_winner', true);
            setOfficials(data || []);
        };

        loadOfficials();

        // Subscribe to changes
        const subscription = supabase
            .channel('candidates-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'candidates',
                    filter: 'is_winner=eq.true'
                },
                (payload) => {
                    console.log('Change received!', payload);
                    loadOfficials(); // Reload data
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return { officials };
};
```

---

## 5. 배포 및 테스트

### Step 1: 환경 변수 설정 확인

```env
# .env.local (개발)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Vercel/Netlify 배포 시 환경 변수 추가
```

### Step 2: 테스트 체크리스트

- [ ] 지역별 공약 조회 테스트
- [ ] 인물별 공약 조회 테스트
- [ ] 검색 기능 테스트
- [ ] 필터링 기능 테스트
- [ ] 페이지네이션 테스트
- [ ] 다크모드 전환 테스트
- [ ] 모바일 반응형 테스트

### Step 3: 성능 모니터링

Supabase Dashboard에서:
- Database → Performance 확인
- API → Usage 모니터링
- Storage → 용량 확인

---

## 6. 주요 변경 사항 요약

### 장점 ✅
1. **서버리스 아키텍처**: 백엔드 서버 불필요
2. **실시간 업데이트**: Realtime subscriptions 지원
3. **확장성**: PostgreSQL 기반으로 대용량 데이터 처리 가능
4. **인증/권한**: Built-in auth 시스템
5. **RESTful API**: 자동 생성되는 REST API
6. **Full Text Search**: 강력한 검색 기능

### 고려사항 ⚠️
1. **비용**: Free tier 제한 (500MB DB, 1GB 파일 스토리지, 2GB 대역폭/월)
2. **네트워크 의존**: 클라이언트가 인터넷 연결 필요
3. **마이그레이션**: 기존 SQLite 데이터를 Supabase로 이관 필요

---

## 7. 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Supabase React 가이드](https://supabase.com/docs/guides/with-react)
- [PostgreSQL Full Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

---

## 8. 마이그레이션 타임라인 (예상)

| 단계 | 작업 | 소요 시간 |
|------|------|----------|
| 1 | Supabase 프로젝트 설정 | 30분 |
| 2 | 데이터베이스 스키마 생성 | 1시간 |
| 3 | 데이터 마이그레이션 | 1시간 |
| 4 | 프론트엔드 코드 수정 | 3-4시간 |
| 5 | 테스트 및 디버깅 | 2-3시간 |
| **총합** | | **8-10시간** |

---

## 문의 및 지원

마이그레이션 중 문제가 발생하면:
1. Supabase Discord 커뮤니티 참고
2. GitHub Issues에 질문 등록
3. Supabase 공식 문서 확인
