/*
 * 큰길이벤트기획 — 견적 품목표와 견적 코드 읽기
 *
 * quote.html 과 schedule.html 이 함께 쓴다. 품목을 고칠 곳은 여기 하나뿐이다.
 * 견적서에는 서버가 없다 — 견적 하나가 주소 뒤 #q= 에 담기는 짧은 코드 하나다.
 * 그 코드를 푸는 규칙도 여기 둔다(두 화면이 같은 규칙으로 읽어야 하니까).
 */

const CATALOG = [
  { group:'음향', items:[
    { id:'a1', name:'음향 (소형)',       spec:'포터블 · 100명 내외 · 마이크 2ch', unit:'식', price:null },
    { id:'a2', name:'음향 (중형)',       spec:'300명 내외 · 스피커 4통 · 콘솔',    unit:'식', price:null },
    { id:'a3', name:'음향 (대형)',       spec:'FBT 라인어레이 · 500명 이상',       unit:'식', price:null },
    { id:'a4', name:'무선 마이크 추가',  spec:'핸드 / 핀 마이크',                  unit:'개', price:null },
    { id:'a5', name:'인이어 모니터',     spec:'밴드 · 가수 라이브용',              unit:'식', price:null },
    { id:'a6', name:'악기 렌탈 (백라인)', spec:'드럼 · 기타 · 베이스 앰프 · 키보드', unit:'식', price:null },
  ]},
  { group:'조명', items:[
    { id:'b1', name:'기본 조명',         spec:'파라이트 세트 · 실내외',            unit:'식', price:null },
    { id:'b2', name:'무빙라이트',        spec:'빔 / 워시',                         unit:'대', price:null },
    { id:'b3', name:'팔로우 스팟',       spec:'오퍼레이터 포함',                   unit:'대', price:null },
    { id:'b4', name:'조명 트러스 시공',  spec:'구조물 설치 · 철수 포함',           unit:'식', price:null },
  ]},
  { group:'LED · 영상', items:[
    { id:'c1', name:'LED 전광판 200인치', spec:'실내외 겸용',                       unit:'식', price:null },
    { id:'c2', name:'LED 전광판 300인치', spec:'실내외 겸용',                       unit:'식', price:null },
    { id:'c3', name:'LED 전광판 400인치', spec:'실내외 겸용 · 대형 행사',           unit:'식', price:null },
    { id:'c7', name:'레이허 구조물',     spec:'LED 거치용 시스템 비계 · 설치 · 철수', unit:'식', price:null },
    { id:'c4', name:'빔 프로젝터 · 스크린', spec:'실내 행사용',                    unit:'식', price:null },
    { id:'c5', name:'실시간 중계 · 송출', spec:'카메라 · 스위처 · 송출',           unit:'식', price:null },
    { id:'c6', name:'영상 오퍼레이터',   spec:'식순 영상 · 자막 운용',             unit:'명', price:null },
  ]},
  { group:'무대 · 구조물', items:[
    { id:'d1', name:'조립식 무대 10평',  spec:'높이 30~60cm',                      unit:'식', price:null },
    { id:'d6', name:'조립식 무대 20평',  spec:'높이 60~120cm',                     unit:'식', price:null },
    { id:'d7', name:'조립식 무대 30평',  spec:'높이 60~120cm',                     unit:'식', price:null },
    { id:'d8', name:'조립식 무대 40평 이상', spec:'높이 60~120cm · 규모 협의',     unit:'식', price:null },
    { id:'d2', name:'백드롭 트러스',     spec:'현수막 거치용',                     unit:'m',  price:null },
    { id:'d3',  name:'자바라 텐트 3m×3m', spec:'원터치 · 설치 · 철수',            unit:'동', price:null, qty:true },
    { id:'d10', name:'자바라 텐트 3m×6m', spec:'원터치 · 설치 · 철수',            unit:'동', price:null, qty:true },
    { id:'d11', name:'몽골텐트',          spec:'원터치 대형 텐트',                 unit:'동', price:null, qty:true },
    { id:'d9',  name:'의자',              spec:'행사용 팔걸이 의자',               unit:'개', price:null, qty:true },
    { id:'d12', name:'테이블',            spec:'원형 · 직사각 · 회의용',           unit:'개', price:null, qty:true },
    { id:'d13', name:'테이블보',          spec:'테이블 크기에 맞춰',               unit:'장', price:null, qty:true },
    { id:'d4', name:'포토존 제작',       spec:'구조물 + 출력물',                   unit:'식', price:null },
    { id:'d5', name:'현수막 · 배너',     spec:'실사 출력',                         unit:'장', price:null },
  ]},
  { group:'특수효과', items:[
    { id:'e1', name:'스모그 · 헤이저',   spec:'무대 연출용',                       unit:'식', price:null },
    { id:'e2', name:'무대 불꽃',         spec:'스파클러 · 실내외',                 unit:'식', price:null },
    { id:'e5', name:'에어샷',            spec:'컨페티 · 은박 테이프 발사',         unit:'대', price:null, qty:true },
    { id:'e3', name:'업포그 머신',       spec:'무대 바닥 연기 연출',               unit:'식', price:null },
    { id:'e4', name:'드론쇼',            spec:'대수 · 시간에 따라 별도 협의',      unit:'식', price:null },
  ]},
  { group:'인력 · 출연', items:[
    { id:'f1', name:'MC · 사회자',       spec:'전문 진행자',                       unit:'명', price:null },
    { id:'f2', name:'가수 섭외',         spec:'행사 성격에 맞는 라인업',           unit:'팀', price:null },
    { id:'f3', name:'전자바이올린 · 앙상블', spec:'연주 공연',                     unit:'팀', price:null },
    { id:'f4', name:'댄스팀',            spec:'오프닝 · 축하공연',                 unit:'팀', price:null },
    { id:'f5', name:'행사 스탭',         spec:'현장 진행 인력',                    unit:'명', price:null },
  ]},
  { group:'체험 · 부대행사', items:[
    { id:'h1', name:'에어바운스',        spec:'공기주입식 놀이기구 · 송풍기 포함',  unit:'동', price:null, qty:true },
    { id:'h2', name:'수영장',            spec:'이동식 물놀이장 · 급배수 협의',      unit:'동', price:null, qty:true },
    { id:'h3', name:'게임도구',          spec:'명랑운동회 · 레크리에이션 종목별',   unit:'식', price:null },
    { id:'h4', name:'체육용품',          spec:'줄다리기 · 박 터뜨리기 · 계주 · 단체 종목', unit:'식', price:null },
  ]},
  { group:'기타', items:[
    { id:'g1', name:'발전차',            spec:'전원 미확보 현장',                  unit:'대', price:null },
    { id:'g2', name:'운반 · 설치 인건비', spec:'상하차 · 설치 · 철수',             unit:'식', price:null },
    { id:'g3', name:'출장비',            spec:'전남 외 지역',                      unit:'식', price:null },
  ]},
];
const BY_ID = {};
CATALOG.forEach(g => g.items.forEach(it => { BY_ID[it.id] = it; }));

const 견적정보칸 = ['org','name','tel','email','title','date','place','people','memo'];
const 견적정보짧게 = { org:'o', name:'n', tel:'t', email:'e', title:'m', date:'d', place:'p', people:'c', memo:'x' };

const 견적b64u   = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const 견적unb64u = (s) => {
  let t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return decodeURIComponent(escape(atob(t)));
};

/**
 * 견적 코드를 사람이 읽을 수 있는 모양으로 푼다.
 *   { 정보:{org,name,tel,…}, 줄:[{id,name,spec,qty,unit,days,price}], 할인 }
 * 못 읽으면 null.
 */
function 견적풀기(코드) {
  try {
    const s = JSON.parse(견적unb64u(코드));
    const 정보 = {};
    견적정보칸.forEach((k, idx) => {
      const i = s.i;
      if (!i) { 정보[k] = ''; return; }
      const v = Array.isArray(i) ? i[idx]
              : (i[견적정보짧게[k]] != null ? i[견적정보짧게[k]] : i[k]);
      정보[k] = v == null ? '' : String(v);
    });

    const 책 = (id) => BY_ID[id] || { name: '', spec: '', unit: '식' };
    const 줄 = (s.r || []).map((a) => {
      if (typeof a === 'string') {
        const c = 책(a);
        return { id: a, name: c.name, spec: c.spec, qty: 1, unit: c.unit, days: 1, price: null };
      }
      if (a.length <= 4) {
        const c = 책(a[0]);
        return { id: a[0], name: c.name, spec: c.spec,
                 qty: a[1] != null ? a[1] : 1, unit: c.unit,
                 days: a[2] != null ? a[2] : 1,
                 price: a[3] != null ? a[3] : null };
      }
      return { id: a[0], name: a[1], spec: a[2], qty: a[3], unit: a[4], days: a[5], price: a[6] };
    });

    return { 정보: 정보, 줄: 줄, 할인: +s.d || 0 };
  } catch (e) { return null; }
}

/* 견적 한 줄을 「300명 내외 · 스피커 4통 · 2개 · 2일」 같은 한 줄 설명으로 */
function 견적줄설명(r) {
  return [r.spec, (+r.qty > 1 ? r.qty + (r.unit || '') : ''), (+r.days > 1 ? r.days + '일' : '')]
    .filter(Boolean).join(' · ');
}
