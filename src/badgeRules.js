import { hsCount, normalizeDay, NON_SALES_STORES } from './appShared';
import { completedHomeCount } from './policyRules';
import { getPersonalGoalActuals } from './components/MonthlyPerformance';
export const MONTHLY_RANK_METRICS = [
  { key:'hs', label:'HS', unit:'건', value:(r)=>hsCount(r.draft) },
  { key:'home', label:'홈', unit:'건', value:(r)=>completedHomeCount(r.draft) },
  { key:'free', label:'프리', unit:'건', value:(r)=>Number(r.draft?.homeFlat?.tvFree||0) },
  { key:'smart', label:'스홈', unit:'건', value:(r)=>Number(r.draft?.homeFlat?.smartHome||0) },
  { key:'productivity', label:'생산성', unit:'P', value:(r)=>Number(r.pay?.kpiScore||0) },
  { key:'upsell', label:'맞춤제안 업셀건', unit:'건', value:(r)=>Number(r.draft?.tailoredCount||0) },
];

export const BADGE_DEFS = [
  { key: 'first_step', icon: '🌱', name: '첫 발자국', rarity: 'COMMON', hidden: false, desc: '첫 HS 판매', auto: true },
  { key: 'hs_y10', icon: '🔟', name: '스타트 텐', rarity: 'COMMON', hidden: false, desc: '올해 HS 10건', auto: true },
  { key: 'hs_y30', icon: '🏃', name: '페이스 업', rarity: 'COMMON', hidden: false, desc: '올해 HS 30건', auto: true },
  { key: 'hs_y50', icon: '🎯', name: '하프 센추리', rarity: 'RARE', hidden: false, desc: '올해 HS 50건', auto: true },
  { key: 'hs_y100', icon: '💯', name: '백전백승', rarity: 'RARE', hidden: false, desc: '올해 HS 100건', auto: true },
  { key: 'hs_y150', icon: '🚀', name: '150 클럽', rarity: 'RARE', hidden: false, desc: '올해 HS 150건', auto: true },
  { key: 'hs_y200', icon: '🔥', name: '200 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 200건', auto: true },
  { key: 'hs_y250', icon: '⚡', name: '250 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 250건', auto: true },
  { key: 'hs_y300', icon: '💎', name: '300 클럽', rarity: 'EPIC', hidden: false, desc: '올해 HS 300건', auto: true },
  { key: 'hs_y500', icon: '👑', name: '500 클럽', rarity: 'LEGEND', hidden: false, desc: '올해 HS 500건', auto: true },
  { key: 'hs_m20', icon: '📦', name: '월간 20', rarity: 'COMMON', hidden: false, desc: '한 달 HS 20건', auto: true },
  { key: 'hs_m30', icon: '📈', name: '월간 30', rarity: 'RARE', hidden: false, desc: '한 달 HS 30건', auto: true },
  { key: 'hs_m40', icon: '🔥', name: '월간 40', rarity: 'RARE', hidden: false, desc: '한 달 HS 40건', auto: true },
  { key: 'hs_m50', icon: '🦁', name: '50의 벽', rarity: 'EPIC', hidden: false, desc: '한 달 HS 50건', auto: true },
  { key: 'hs_m60', icon: '🚀', name: '월간 폭주', rarity: 'EPIC', hidden: false, desc: '한 달 HS 60건', auto: true },
  { key: 'hs_m70', icon: '💥', name: '브레이크 아웃', rarity: 'EPIC', hidden: false, desc: '한 달 HS 70건', auto: true },
  { key: 'hs_m80', icon: '🏆', name: '80 클럽', rarity: 'LEGEND', hidden: false, desc: '한 달 HS 80건', auto: true },
  { key: 'hs_m100', icon: '💯', name: '월간 센추리', rarity: 'LEGEND', hidden: false, desc: '한 달 HS 100건', auto: true },
  { key: 'hs_personal_record', icon: '🌋', name: '한계 돌파', rarity: 'RARE', hidden: false, desc: '자신의 월 HS 최고기록 경신', auto: true },
  { key: 'hs_guinness', icon: '🐐', name: '미소 기네스 · HS', rarity: 'LEGEND', hidden: false, desc: '회사 역대 월 HS 최고기록 경신', auto: true },
  { key: 'hs_rank3', icon: '🥉', name: '포디움', rarity: 'RARE', hidden: false, desc: '월 HS 전체 3위', auto: true },
  { key: 'hs_rank2', icon: '🥈', name: '실버 러시', rarity: 'EPIC', hidden: false, desc: '월 HS 전체 2위', auto: true },
  { key: 'hs_rank1', icon: '🥇', name: '이번 달 주인공', rarity: 'EPIC', hidden: false, desc: '월 HS 전체 1위', auto: true },
  { key: 'hs_year1', icon: '👑', name: '올해의 HS KING', rarity: 'LEGEND', hidden: false, desc: '올해 누적 HS 전체 1위', auto: true },
  { key: 'hs_store1', icon: '🏠', name: '우리 매장 ACE', rarity: 'RARE', hidden: false, desc: '월 HS 매장 1위', auto: true },
  { key: 'hs_back2back', icon: '🔥', name: '백투백', rarity: 'LEGEND', hidden: false, desc: '월 HS 1위 2개월 연속', auto: true },
  { key: 'hs_triple', icon: '🏆', name: '트리플 크라운', rarity: 'LEGEND', hidden: false, desc: '월 HS 1위 3회', auto: true },
  { key: 'hs_top10', icon: '🎖', name: 'TOP10', rarity: 'COMMON', hidden: false, desc: '월 HS 전체 10위 이내', auto: true },
  { key: 'hs_top5', icon: '⭐', name: 'TOP5', rarity: 'RARE', hidden: false, desc: '월 HS 전체 5위 이내', auto: true },
  { key: 'hs_top10_3m', icon: '🧱', name: '자리 지킴이', rarity: 'EPIC', hidden: false, desc: '3개월 연속 HS TOP10', auto: true },
  { key: 'home_first', icon: '🏠', name: '첫 홈', rarity: 'COMMON', hidden: false, desc: '첫 홈 판매', auto: true },
  { key: 'home_m5', icon: '🏡', name: '홈 스타터', rarity: 'COMMON', hidden: false, desc: '월 홈 5건', auto: true },
  { key: 'home_m10', icon: '🏘', name: '홈 러너', rarity: 'RARE', hidden: false, desc: '월 홈 10건', auto: true },
  { key: 'home_m15', icon: '🏢', name: '홈 프로', rarity: 'RARE', hidden: false, desc: '월 홈 15건', auto: true },
  { key: 'home_m20', icon: '🏰', name: '홈 마스터', rarity: 'EPIC', hidden: false, desc: '월 홈 20건', auto: true },
  { key: 'home_y100', icon: '💯', name: '홈 센추리', rarity: 'EPIC', hidden: false, desc: '올해 홈 100건', auto: true },
  { key: 'home_rank1', icon: '👑', name: '홈 KING', rarity: 'EPIC', hidden: false, desc: '월 홈 전체 1위', auto: true },
  { key: 'home_year1', icon: '🏆', name: '올해의 홈 KING', rarity: 'LEGEND', hidden: false, desc: '올해 홈 누적 1위', auto: true },
  { key: 'home_day3', icon: '🔥', name: '홈 올인', rarity: 'RARE', hidden: false, desc: '하루 홈 3건 이상', auto: true },
  { key: 'internet_y50', icon: '📡', name: '인터넷 전문가', rarity: 'RARE', hidden: false, desc: '인터넷 연간 50건', auto: true },
  { key: 'hometv_m10', icon: '📺', name: 'TV 콤보', rarity: 'RARE', hidden: false, desc: '홈+TV 월 10건', auto: true },
  { key: 'home_guinness', icon: '🐐', name: '미소 기네스 · 홈', rarity: 'LEGEND', hidden: false, desc: '회사 역대 월 홈 최고기록', auto: true },
  { key: 'free_first', icon: '📺', name: '프리 스타트', rarity: 'COMMON', hidden: false, desc: '첫 TV프리', auto: true },
  { key: 'free_m5', icon: '🪽', name: '프리 러너', rarity: 'COMMON', hidden: false, desc: '월 프리 5건', auto: true },
  { key: 'free_m10', icon: '📺', name: '프리 마스터', rarity: 'RARE', hidden: false, desc: '월 프리 10건', auto: true },
  { key: 'free_rank1', icon: '👑', name: '프리 KING', rarity: 'EPIC', hidden: false, desc: '월 프리 전체 1위', auto: true },
  { key: 'free_y100', icon: '💯', name: '프리 센추리', rarity: 'EPIC', hidden: false, desc: '올해 프리 100건', auto: true },
  { key: 'smart_first', icon: '💡', name: '스마트 스타트', rarity: 'COMMON', hidden: false, desc: '첫 스마트홈', auto: true },
  { key: 'smart_m5', icon: '🏡', name: '스마트 라이프', rarity: 'COMMON', hidden: false, desc: '월 스마트홈 5건', auto: true },
  { key: 'smart_m10', icon: '💡', name: '스마트 마스터', rarity: 'RARE', hidden: false, desc: '월 스마트홈 10건', auto: true },
  { key: 'smart_rank1', icon: '👑', name: '스홈 KING', rarity: 'EPIC', hidden: false, desc: '월 스마트홈 전체 1위', auto: true },
  { key: 'smart_y50', icon: '🧠', name: '스마트 컬렉터', rarity: 'EPIC', hidden: false, desc: '올해 스마트홈 50건', auto: true },
  { key: 'upsell_first', icon: '🎯', name: '첫 적중', rarity: 'COMMON', hidden: false, desc: '첫 맞춤제안 업셀', auto: true },
  { key: 'upsell_m5', icon: '🎯', name: '취향저격', rarity: 'COMMON', hidden: false, desc: '월 맞춤제안 업셀 5건', auto: true },
  { key: 'upsell_m10', icon: '📈', name: '업셀러', rarity: 'RARE', hidden: false, desc: '월 맞춤제안 업셀 10건', auto: true },
  { key: 'upsell_m20', icon: '🚀', name: '업셀 마스터', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 업셀 20건', auto: true },
  { key: 'upsell_rank1', icon: '👑', name: '업셀 KING', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 업셀 전체 1위', auto: true },
  { key: 'upsell_y100', icon: '💯', name: '업셀 센추리', rarity: 'EPIC', hidden: false, desc: '올해 맞춤제안 업셀 100건', auto: true },
  { key: 'upsell_day3', icon: '🦅', name: '기회 포착', rarity: 'RARE', hidden: false, desc: '하루 맞춤제안 업셀 3건', auto: true },
  { key: 'upsell_day5', icon: '🔥', name: '업셀 폭주', rarity: 'EPIC', hidden: false, desc: '하루 맞춤제안 업셀 5건', auto: true },
  { key: 'upsell_year1', icon: '🏆', name: '올해의 업셀 KING', rarity: 'LEGEND', hidden: false, desc: '올해 누적 업셀 1위', auto: true },
  { key: 'upsell_guinness', icon: '🐐', name: '미소 기네스 · 업셀', rarity: 'LEGEND', hidden: false, desc: '역대 월 업셀 최고기록', auto: true },
  { key: 'upsell_goal100', icon: '🎯', name: '정조준', rarity: 'RARE', hidden: false, desc: '월 맞춤제안 목표 100%', auto: true },
  { key: 'upsell_goal150', icon: '💥', name: '오버클럭', rarity: 'EPIC', hidden: false, desc: '월 맞춤제안 목표 150%', auto: true },
  { key: 'second_first', icon: '📱', name: '하나 더', rarity: 'COMMON', hidden: false, desc: '첫 2ND 번들', auto: true },
  { key: 'second_m5', icon: '✌️', name: '투게더', rarity: 'COMMON', hidden: false, desc: '월 2ND 5건', auto: true },
  { key: 'second_m10', icon: '📦', name: '번들러', rarity: 'RARE', hidden: false, desc: '월 2ND 10건', auto: true },
  { key: 'second_m20', icon: '🚀', name: '번들 마스터', rarity: 'EPIC', hidden: false, desc: '월 2ND 20건', auto: true },
  { key: 'second_rank1', icon: '👑', name: '2ND KING', rarity: 'EPIC', hidden: false, desc: '월 2ND 전체 1위', auto: true },
  { key: 'second_y100', icon: '💯', name: '2ND 센추리', rarity: 'EPIC', hidden: false, desc: '올해 2ND 100건', auto: true },
  { key: 'second_day3', icon: '🛒', name: '장바구니 가득', rarity: 'RARE', hidden: false, desc: '하루 2ND 번들 3건', auto: true },
  { key: 'second_guinness', icon: '🐐', name: '미소 기네스 · 2ND', rarity: 'LEGEND', hidden: false, desc: '역대 월 2ND 최고기록', auto: true },
  { key: 'prod_base', icon: '⚙️', name: '시동 완료', rarity: 'COMMON', hidden: false, desc: '월 생산성 기준 달성', auto: true },
  { key: 'prod_100', icon: '📈', name: '생산성 100', rarity: 'RARE', hidden: false, desc: '월 생산성 100P', auto: true },
  { key: 'prod_120', icon: '⚡', name: '생산성 120', rarity: 'RARE', hidden: false, desc: '월 생산성 120P', auto: true },
  { key: 'prod_150', icon: '🔥', name: '생산성 150', rarity: 'EPIC', hidden: false, desc: '월 생산성 150P', auto: true },
  { key: 'prod_200', icon: '🚀', name: '생산성 200', rarity: 'LEGEND', hidden: false, desc: '월 생산성 200P', auto: true },
  { key: 'prod_rank1', icon: '👑', name: '생산성 KING', rarity: 'EPIC', hidden: false, desc: '월 생산성 전체 1위', auto: true },
  { key: 'prod_year1', icon: '🏆', name: '올해의 생산성 KING', rarity: 'LEGEND', hidden: false, desc: '연간 평균 생산성 1위', auto: true },
  { key: 'grade_s', icon: '💎', name: 'S CLASS', rarity: 'EPIC', hidden: false, desc: '성과등급 S 달성', auto: true },
  { key: 'grade_s3', icon: '🔥', name: 'S STREAK', rarity: 'LEGEND', hidden: false, desc: 'S등급 3개월 연속', auto: true },
  { key: 'all_top3', icon: '🐐', name: '완전체', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 모두 월 TOP3', auto: true },
  { key: 'day_hs5', icon: '🔥', name: '불타는 하루', rarity: 'RARE', hidden: false, desc: '하루 HS 5건', auto: true },
  { key: 'day_hs8', icon: '💥', name: '미친 하루', rarity: 'EPIC', hidden: false, desc: '하루 HS 8건', auto: true },
  { key: 'day_hs10', icon: '☄️', name: '레코드 데이', rarity: 'LEGEND', hidden: false, desc: '하루 HS 10건', auto: true },
  { key: 'full_set', icon: '🛍', name: '풀세트', rarity: 'RARE', hidden: false, desc: '하루 HS+홈+2ND 모두 판매', auto: true },
  { key: 'allrounder', icon: '🎯', name: '올라운더', rarity: 'RARE', hidden: false, desc: '한 달 핵심 5개 카테고리 모두 실적', auto: true },
  { key: 'balance_master', icon: '🌈', name: '밸런스 마스터', rarity: 'EPIC', hidden: false, desc: '핵심 5개 카테고리 모두 월 목표 달성', auto: true },
  { key: 'sweep_day', icon: '🧹', name: '싹쓸이', rarity: 'EPIC', hidden: false, desc: '하루 5개 이상 판매 카테고리 실적', auto: true },
  { key: 'perfect_month', icon: '💎', name: '퍼펙트 먼스', rarity: 'LEGEND', hidden: false, desc: '해당 월 핵심 KPI 전부 목표 달성', auto: true },
  { key: 'grand_slam', icon: '👑', name: '그랜드슬램', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 월간 1위 동시 달성', auto: true },
  { key: 'goat', icon: '🐐', name: 'GOAT', rarity: 'LEGEND', hidden: false, desc: '연간 HS·홈·생산성 모두 전체 TOP3', auto: true },
  { key: 'tenure3', icon: '🌱', name: '미소 새싹', rarity: 'COMMON', hidden: false, desc: '입사 3개월', auto: true },
  { key: 'tenure12', icon: '🎂', name: '첫 돌', rarity: 'COMMON', hidden: false, desc: '근속 12개월', auto: true },
  { key: 'tenure24', icon: '🌳', name: '뿌리내림', rarity: 'RARE', hidden: false, desc: '근속 24개월', auto: true },
  { key: 'tenure36', icon: '🌲', name: '뿌리 깊은 미소', rarity: 'EPIC', hidden: false, desc: '근속 36개월', auto: true },
  { key: 'tenure60', icon: '🏛', name: '미소 베테랑', rarity: 'LEGEND', hidden: false, desc: '근속 60개월', auto: true },
  { key: 'special_pick', icon: '📈', name: '성장왕', rarity: 'RARE', hidden: false, desc: '월 후반 HS 페이스가 전반보다 크게 상승', auto: true },
  { key: 'special_team', icon: '🎯', name: '올라운드 세일즈', rarity: 'EPIC', hidden: false, desc: 'HS·홈·프리·스홈·2ND를 모두 판매', auto: true },
  { key: 'special_mvp', icon: '🏆', name: '미소 MVP', rarity: 'LEGEND', hidden: false, desc: 'HS·홈·생산성 종합 순위 월 1위', auto: true }
  ,{ key:'tenure1', icon:'👋', name:'미소 첫 달', rarity:'COMMON', hidden:false, desc:'근속 1개월', auto:true, progressMetric:'tenure', threshold:1 }
  ,{ key:'tenure6', icon:'🌿', name:'반년의 발자국', rarity:'COMMON', hidden:false, desc:'근속 6개월', auto:true, progressMetric:'tenure', threshold:6 }
  ,{ key:'tenure18', icon:'🌱', name:'단단한 뿌리', rarity:'RARE', hidden:false, desc:'근속 18개월', auto:true, progressMetric:'tenure', threshold:18 }
  ,{ key:'tenure48', icon:'🤝', name:'믿음의 동료', rarity:'EPIC', hidden:false, desc:'근속 48개월', auto:true, progressMetric:'tenure', threshold:48 }
  ,{ key:'tenure72', icon:'🏛️', name:'미소의 기둥', rarity:'EPIC', hidden:false, desc:'근속 72개월', auto:true, progressMetric:'tenure', threshold:72 }
  ,{ key:'tenure84', icon:'✨', name:'오래된 신뢰', rarity:'EPIC', hidden:false, desc:'근속 84개월', auto:true, progressMetric:'tenure', threshold:84 }
  ,{ key:'tenure96', icon:'📜', name:'미소 히스토리', rarity:'LEGEND', hidden:false, desc:'근속 96개월', auto:true, progressMetric:'tenure', threshold:96 }
  ,{ key:'tenure108', icon:'🌟', name:'미소 레전드', rarity:'LEGEND', hidden:false, desc:'근속 108개월', auto:true, progressMetric:'tenure', threshold:108 }
  ,{ key:'tenure120', icon:'🎖️', name:'미소 명예직원', rarity:'LEGEND', hidden:false, desc:'근속 120개월', auto:true, progressMetric:'tenure', threshold:120 }
  ,{ key:'tenure180', icon:'🏛️', name:'미소의 역사', rarity:'LEGEND', hidden:false, desc:'근속 180개월', auto:true, progressMetric:'tenure', threshold:180 }
  ,...[
    [25,'🏡','우리집 안내자','COMMON'],[50,'🧭','홈 네비게이터','RARE'],[100,'💯','홈 백부장','RARE'],[200,'🏗️','홈 아키텍트','EPIC'],[300,'🌉','홈 커넥터','EPIC'],[500,'🏰','홈 그랜드마스터','LEGEND'],[750,'🏙️','홈 타운 빌더','LEGEND'],[1000,'🏆','천 개의 연결','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_home_${threshold}`,icon,name,rarity,hidden:false,desc:`통산 홈 ${threshold}건`,auto:true,progressMetric:'home',threshold}))
  ,...[
    [25,'🪄','프리 캐처','COMMON'],[50,'📺','프리 스페셜리스트','RARE'],[100,'💯','프리 백부장','RARE'],[200,'🎬','프리 디렉터','EPIC'],[300,'⭐','프리 아이콘','EPIC'],[500,'👑','프리 레전드','LEGEND'],[1000,'🌌','프리 신화','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_free_${threshold}`,icon,name,rarity,hidden:false,desc:`통산 TV프리 ${threshold}건`,auto:true,progressMetric:'free',threshold}))
  ,...[
    [10,'🛠️','스마트 메이커','COMMON'],[25,'💡','스마트 가이드','COMMON'],[50,'🎨','라이프 디자이너','RARE'],[100,'💯','스마트 백부장','RARE'],[200,'🏗️','스마트 아키텍트','EPIC'],[300,'🧠','미래생활 전문가','EPIC'],[500,'👑','스마트홈 레전드','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_smart_${threshold}`,icon,name,rarity,hidden:false,desc:`통산 스마트홈 ${threshold}건`,auto:true,progressMetric:'smart',threshold}))
  ,...[
    [25,'🔎','니즈 탐험가','COMMON'],[50,'💡','제안의 기술','RARE'],[100,'🎯','백 번의 적중','RARE'],[200,'📈','업셀 스페셜리스트','EPIC'],[300,'💎','가치 설계자','EPIC'],[500,'🧙','제안의 달인','LEGEND'],[750,'🧭','세일즈 디렉터','LEGEND'],[1000,'🏆','천 번의 선택','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_upsell_${threshold}`,icon,name,rarity,hidden:false,desc:`통산 맞춤제안 업셀 ${threshold}건`,auto:true,progressMetric:'upsell',threshold}))
  ,...[
    [1,'🌱','소노 첫 만남','COMMON'],[5,'🌅','라이프 스타터','COMMON'],[10,'🔟','소노 텐','COMMON'],[25,'🏖️','휴식 설계자','RARE'],[50,'🧭','라이프 플래너','RARE'],[100,'💯','소노 백부장','RARE'],[200,'🎟️','소노 스페셜리스트','EPIC'],[300,'✨','라이프 큐레이터','EPIC'],[500,'👑','소노 마스터','LEGEND'],[1000,'🌌','라이프케어 레전드','LEGEND']
  ].map(([threshold,icon,name,rarity])=>({key:`career_sono_${threshold}`,icon,name,rarity,hidden:false,desc:`통산 소노 ${threshold}건`,auto:true,progressMetric:'sono',threshold}))
];

export function evaluateAutomaticBadges({
  dailyDays, month, personalGoals, mergedDraft, pay, competitionRows, userId, lifetimeTotals,
}) {
  const earned=new Set();
  const hs=hsCount(mergedDraft);
  const home=completedHomeCount(mergedDraft);
  const free=Number(mergedDraft?.homeFlat?.tvFree||0);
  const smart=Number(mergedDraft?.homeFlat?.smartHome||0);
  const upsell=Number(mergedDraft?.tailoredCount||0);
  const second=(mergedDraft?.matrix?.[7]||[]).reduce((a,v)=>a+Number(v||0),0)+Object.values(mergedDraft?.bundle2nd||{}).reduce((a,v)=>a+Number(v||0),0);
  const prod=Number(pay?.kpiScore||0);
  const tenureMonths=Number(pay?.months||0);
  [[1,'tenure1'],[3,'tenure3'],[6,'tenure6'],[12,'tenure12'],[18,'tenure18'],[24,'tenure24'],[36,'tenure36'],[48,'tenure48'],[60,'tenure60'],[72,'tenure72'],[84,'tenure84'],[96,'tenure96'],[108,'tenure108'],[120,'tenure120'],[180,'tenure180']].forEach(([months,key])=>{
    if(tenureMonths>=months)earned.add(key);
  });
  BADGE_DEFS.filter(b=>b.progressMetric&&b.progressMetric!=='tenure').forEach(b=>{
    if(Number(lifetimeTotals?.[b.progressMetric]||0)>=Number(b.threshold||0))earned.add(b.key);
  });
  if(hs>0)earned.add('first_step');
  [[20,'hs_m20'],[30,'hs_m30'],[40,'hs_m40'],[50,'hs_m50'],[60,'hs_m60'],[70,'hs_m70'],[80,'hs_m80'],[100,'hs_m100']].forEach(([v,k])=>{if(hs>=v)earned.add(k)});
  [[1,'home_first'],[5,'home_m5'],[10,'home_m10'],[15,'home_m15'],[20,'home_m20']].forEach(([v,k])=>{if(home>=v)earned.add(k)});
  [[1,'free_first'],[5,'free_m5'],[10,'free_m10']].forEach(([v,k])=>{if(free>=v)earned.add(k)});
  [[1,'smart_first'],[5,'smart_m5'],[10,'smart_m10']].forEach(([v,k])=>{if(smart>=v)earned.add(k)});
  [[1,'upsell_first'],[5,'upsell_m5'],[10,'upsell_m10'],[20,'upsell_m20']].forEach(([v,k])=>{if(upsell>=v)earned.add(k)});
  [[1,'second_first'],[5,'second_m5'],[10,'second_m10'],[20,'second_m20']].forEach(([v,k])=>{if(second>=v)earned.add(k)});
  [[100,'prod_100'],[120,'prod_120'],[150,'prod_150'],[200,'prod_200']].forEach(([v,k])=>{if(prod>=v)earned.add(k)});
  if(pay?.grade==='S'&&pay?.gradeEligible)earned.add('grade_s');

  const rank=(key)=>{
    const m=MONTHLY_RANK_METRICS.find(x=>x.key===key); if(!m)return null;
    const rows=[...(competitionRows||[])].filter(r=>!NON_SALES_STORES.includes(r.branch));
    const me=rows.find(r=>r.id===userId); if(!me||Number(m.value(me)||0)<=0)return null;
    return 1+rows.filter(r=>Number(m.value(r)||0)>Number(m.value(me)||0)).length;
  };
  const hr=rank('hs'), homer=rank('home'), freer=rank('free'), smartr=rank('smart'), pr=rank('productivity'), ur=rank('upsell');
  if(hr&&hr<=10)earned.add('hs_top10'); if(hr&&hr<=5)earned.add('hs_top5');
  if(hr===3)earned.add('hs_rank3'); if(hr===2)earned.add('hs_rank2'); if(hr===1)earned.add('hs_rank1');
  if(homer===1)earned.add('home_rank1'); if(freer===1)earned.add('free_rank1'); if(smartr===1)earned.add('smart_rank1');
  if(pr===1)earned.add('prod_rank1'); if(ur===1)earned.add('upsell_rank1');
  if(hr&&hr<=3&&homer&&homer<=3&&pr&&pr<=3)earned.add('all_top3');
  if(hr===1&&homer===1&&pr===1)earned.add('grand_slam');

  // v21.75 자동 배지
  // 올라운드 세일즈: 앱에서 객관적으로 확인 가능한 핵심 판매 카테고리를 모두 경험
  if(hs>0&&home>0&&free>0&&smart>0&&second>0)earned.add('special_team');

  // 미소 MVP: HS/홈/생산성 순위 합이 가장 낮은 직원 1명 (동률은 HS→홈→생산성 순)
  {
    const active=[...(competitionRows||[])].filter(r=>!NON_SALES_STORES.includes(r.branch));
    const rankOf=(metric,row)=>{
      const vals=active.map(x=>Number(metric.value(x)||0));
      const mine=Number(metric.value(row)||0);
      return mine>0 ? 1+vals.filter(v=>v>mine).length : active.length+1;
    };
    const hm=MONTHLY_RANK_METRICS.find(x=>x.key==='hs');
    const hom=MONTHLY_RANK_METRICS.find(x=>x.key==='home');
    const pm=MONTHLY_RANK_METRICS.find(x=>x.key==='productivity');
    if(hm&&hom&&pm&&active.length){
      const ranked=active.map(r=>({r,score:rankOf(hm,r)+rankOf(hom,r)+rankOf(pm,r),hs:Number(hm.value(r)||0),home:Number(hom.value(r)||0),prod:Number(pm.value(r)||0)}))
        .filter(x=>x.hs>0)
        .sort((a,b)=>a.score-b.score||b.hs-a.hs||b.home-a.home||b.prod-a.prod);
      if(ranked[0]?.r?.id===userId)earned.add('special_mvp');
    }
  }

  let firstHalfHs=0,secondHalfHs=0,firstHalfDays=0,secondHalfDays=0;
  Object.entries(dailyDays||{}).forEach(([dayKey,raw])=>{
    const d=normalizeDay(raw);
    const dhs=[0,1,2,3,4].reduce((z,ri)=>z+(d.matrix?.[ri]||[]).reduce((a,v)=>a+Number(v||0),0),0);
    if(dhs>=5)earned.add('day_hs5'); if(dhs>=8)earned.add('day_hs8'); if(dhs>=10)earned.add('day_hs10');
    const dayNum=Number(String(dayKey).slice(-2))||Number(dayKey)||0;
    if(dayNum>=1&&dayNum<=15){firstHalfHs+=dhs;firstHalfDays++;}
    else if(dayNum>=16){secondHalfHs+=dhs;secondHalfDays++;}
  });
  const firstPace=firstHalfDays?firstHalfHs/firstHalfDays:0, secondPace=secondHalfDays?secondHalfHs/secondHalfDays:0;
  if(firstHalfHs>0&&secondHalfHs>0&&secondPace>=firstPace*1.3)earned.add('special_pick');
  const actuals=getPersonalGoalActuals(mergedDraft,pay);
  const tg=Number(personalGoals?.tailored||0);
  if(tg>0&&actuals.tailored>=tg)earned.add('upsell_goal100');
  if(tg>0&&actuals.tailored>=tg*1.5)earned.add('upsell_goal150');
  return earned;
}
