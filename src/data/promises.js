/**
 * Promises Data Provider - DB Based
 *
 * DB의 Pledges 테이블을 promises.json 형식으로 변환
 */

/**
 * DB 공약을 promises.json 형식으로 변환
 *
 * @param {Object} pledge - DB Pledges 테이블의 row
 * @param {Object} candidate - 후보자 정보
 * @returns {Object} promises.json 형식의 객체
 */
export function transformPledgeToPromise(pledge, candidate) {
  if (!pledge) return null;

  // 상태 매핑
  const statusMap = {
    '준비중': '미달성',
    '진행중': '진행중',
    '완료': '달성',
    '보류': '중단',
    '중단': '중단'
  };

  // 진척도 매핑
  const progressMap = {
    '준비중': 0,
    '진행중': 50,
    '완료': 100,
    '보류': 0,
    '중단': 0
  };

  // 카테고리 매핑
  const categoryMap = {
    '교통': '교통인프라',
    '주택': '부동산정책',
    '복지': '복지정책',
    '교육': '교육정책',
    '경제': '경제정책',
    '환경': '환경정책',
    '문화': '문화정책',
    '안전': '안전정책',
    '행정': '행정개혁',
    '의료': '의료정책',
    '일자리': '일자리창출',
    '청년': '청년정책'
  };

  const status = statusMap[pledge.status] || pledge.status;
  const progress = progressMap[pledge.status] || 0;
  const category = categoryMap[pledge.pledge_realm] || pledge.pledge_realm || '기타';

  return {
    id: `pledge-${pledge.pledge_id}`,
    title: pledge.pledge_title,
    category: category,
    level: 'district',  // 국회의원 공약
    officialId: `rep-${candidate.hubo_id}`,
    officialName: candidate.name,
    district: candidate.sgg_name,
    party: candidate.party_name,

    description: pledge.pledge_content || pledge.pledge_title,
    status: status,
    progress: progress,

    order: pledge.pledge_order,
    realm: pledge.pledge_realm,

    startDate: '2024-05-30',  // 제22대 국회 개원일
    targetDate: '2028-05-29',  // 제22대 국회 종료일
    lastUpdated: pledge.last_updated,

    // 빈 배열 (나중에 크롤링으로 채울 예정)
    relatedArticles: [],
    statistics: []
  };
}

/**
 * 여러 공약을 promises 배열로 변환
 */
export function transformPledgesToPromises(pledges, candidates) {
  const candidateMap = new Map(candidates.map(c => [c.hubo_id, c]));

  return pledges
    .map(pledge => {
      const candidate = candidateMap.get(pledge.hubo_id);
      return candidate ? transformPledgeToPromise(pledge, candidate) : null;
    })
    .filter(Boolean);
}

/**
 * 지역별로 공약을 그룹화
 */
export function groupPromisesByRegion(promises) {
  const grouped = {
    national: [],  // 대통령/총리 공약 (현재는 비어있음)
    seoul: [],
    busan: [],
    daegu: [],
    incheon: [],
    gwangju: [],
    daejeon: [],
    ulsan: [],
    sejong: [],
    gyeonggi: [],
    gangwon: [],
    chungbuk: [],
    chungnam: [],
    jeonbuk: [],
    jeonnam: [],
    gyeongbuk: [],
    gyeongnam: [],
    jeju: []
  };

  promises.forEach(promise => {
    // district에서 region 추출
    const region = extractRegionFromDistrict(promise.district);
    if (grouped[region]) {
      grouped[region].push(promise);
    }
  });

  return grouped;
}

/**
 * 선거구명에서 지역 키 추출 (officials.js와 동일 로직)
 */
function extractRegionFromDistrict(districtName) {
  if (!districtName) return 'unknown';

  // 서울
  if (districtName.includes('구') && !districtName.includes('시')) {
    return 'seoul';
  }

  // 경기도
  const gyeonggiCities = ['고양', '수원', '성남', '용인', '부천', '안산', '안양', '남양주', '화성', '평택', '의정부', '시흥', '파주', '김포', '광명', '광주', '군포', '오산', '이천', '양주', '안성', '구리', '포천', '의왕', '하남', '여주', '동두천', '과천'];
  if (gyeonggiCities.some(city => districtName.includes(city))) {
    return 'gyeonggi';
  }

  // 부산
  if (districtName.includes('부산') || ['해운대', '사하', '동래', '남구', '북구', '사상', '금정', '연제', '수영', '기장'].some(d => districtName.startsWith(d))) {
    return 'busan';
  }

  // 대구
  if (districtName.includes('대구') || ['달서', '달성', '수성'].some(d => districtName.startsWith(d))) {
    return 'daegu';
  }

  // 인천
  if (districtName.includes('인천') || ['계양', '부평', '남동', '연수', '중구·강화군·옹진군'].some(d => districtName.includes(d))) {
    return 'incheon';
  }

  // 광주
  if (districtName.includes('광주') && !districtName.includes('시')) {
    return 'gwangju';
  }

  // 대전
  if (districtName.includes('대전') || districtName.includes('유성') || districtName.includes('대덕')) {
    return 'daejeon';
  }

  // 울산
  if (districtName.includes('울산') || districtName.includes('울주')) {
    return 'ulsan';
  }

  // 세종
  if (districtName.includes('세종')) {
    return 'sejong';
  }

  // 강원
  if (['춘천', '원주', '강릉', '동해', '태백', '속초', '삼척', '홍천', '횡성', '영월', '평창', '정선', '철원', '화천', '양구', '인제', '고성', '양양'].some(city => districtName.includes(city))) {
    return 'gangwon';
  }

  // 충북
  if (['청주', '충주', '제천', '보은', '옥천', '영동', '증평', '진천', '괴산', '음성', '단양'].some(city => districtName.includes(city))) {
    return 'chungbuk';
  }

  // 충남
  if (['천안', '공주', '보령', '아산', '서산', '논산', '계룡', '당진', '금산', '부여', '서천', '청양', '홍성', '예산', '태안'].some(city => districtName.includes(city))) {
    return 'chungnam';
  }

  // 전북
  if (['전주', '군산', '익산', '정읍', '남원', '김제', '완주', '진안', '무주', '장수', '임실', '순창', '고창', '부안'].some(city => districtName.includes(city))) {
    return 'jeonbuk';
  }

  // 전남
  if (['목포', '여수', '순천', '나주', '광양', '담양', '곡성', '구례', '고흥', '보성', '화순', '장흥', '강진', '해남', '영암', '무안', '함평', '영광', '장성', '완도', '진도', '신안'].some(city => districtName.includes(city))) {
    return 'jeonnam';
  }

  // 경북
  if (['포항', '경주', '김천', '안동', '구미', '영주', '영천', '상주', '문경', '경산', '군위', '의성', '청송', '영양', '영덕', '청도', '고령', '성주', '칠곡', '예천', '봉화', '울진', '울릉'].some(city => districtName.includes(city))) {
    return 'gyeongbuk';
  }

  // 경남
  if (['창원', '진주', '통영', '사천', '김해', '밀양', '거제', '양산', '의령', '함안', '창녕', '고성', '남해', '하동', '산청', '함양', '거창', '합천'].some(city => districtName.includes(city))) {
    return 'gyeongnam';
  }

  // 제주
  if (districtName.includes('제주') || districtName.includes('서귀포')) {
    return 'jeju';
  }

  return 'unknown';
}
