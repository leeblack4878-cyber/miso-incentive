export const SECOND_PERFORMANCE_POINT = 0.2;
export const INSURANCE_QUALITY_POINT = 0.8;
export const SECOND_ALLOWED_VAS_KEYS = Object.freeze(['vasPhonePass', 'vasSafePass']);

const countValues = (values = {}) => (Array.isArray(values) ? values : Object.values(values || {}))
  .reduce((sum, value) => sum + Number(value || 0), 0);

export function calculateSecondPolicy({ secondOnlyCount = 0, bundleCounts = {}, pointRate = SECOND_PERFORMANCE_POINT } = {}) {
  const standalone = Number(secondOnlyCount || 0);
  const bundled = countValues(bundleCounts);
  const totalCount = standalone + bundled;
  return {
    standalone,
    bundled,
    totalCount,
    activityCount: totalCount,
    performancePoints: Number((totalCount * Number(pointRate || 0)).toFixed(10)),
  };
}

export function calculateActivitySupport({
  monthsEmployed = 0,
  activityCount = 0,
  rate = 0,
  cap = 2300000,
} = {}) {
  const safeCap = Math.max(0, Number(cap || 0));
  if (Number(monthsEmployed || 0) < 6) return safeCap;
  return Math.min(Math.max(0, Number(rate || 0)) * Math.max(0, Number(activityCount || 0)), safeCap);
}

export function calculateFlatIncentive(counts = {}, table = []) {
  return (table || []).reduce((sum, item) => (
    sum + Number(counts?.[item?.key] || 0) * Number(item?.rate || 0)
  ), 0);
}

export function calculateMatrixIncentive(countMatrix = [], rateMatrix = []) {
  return (countMatrix || []).reduce((sum, row, rowIndex) => (
    sum + (row || []).reduce((rowSum, count, columnIndex) => (
      rowSum + Number(count || 0) * Number(rateMatrix?.[rowIndex]?.[columnIndex] || 0)
    ), 0)
  ), 0);
}

export function calculateMobileCommissionParts({
  matrix = [], matrixRates = [], specialMatrixOffset = 0,
  vasCounts = {}, vasRates = [], specialVasOffset = 0, bundleFreeVasOffset = 0,
  bundleCounts = {}, bundleRates = [], bundleFreeOffset = 0,
  penaltyFactor = 1,
} = {}) {
  const matrixTotal = calculateMatrixIncentive(matrix, matrixRates);
  const adjustedMatrixTotal = Math.max(0, matrixTotal - Number(specialMatrixOffset || 0));
  const rawVasPay = calculateFlatIncentive(vasCounts, vasRates);
  const vasPay = Math.max(0, rawVasPay - Number(specialVasOffset || 0) - Number(bundleFreeVasOffset || 0));
  const rawBundle2ndTotal = calculateFlatIncentive(bundleCounts, bundleRates);
  const bundle2ndTotal = Math.max(0, rawBundle2ndTotal - Number(bundleFreeOffset || 0));
  const factor = Math.max(0, Number(penaltyFactor ?? 1));
  const mobilePlanPay = adjustedMatrixTotal * factor;
  const bundle2ndPay = bundle2ndTotal * factor;
  return {
    matrixTotal, adjustedMatrixTotal, rawVasPay, vasPay,
    rawBundle2ndTotal, bundle2ndTotal, mobilePlanPay, bundle2ndPay,
    mobileMatrixPay: mobilePlanPay + bundle2ndPay,
  };
}

export function calculatePayrollSettlement({
  minimumGuarantee = 0,
  tenurePay = 0,
  mobilePlanPay = 0,
  bundle2ndPay = 0,
  vasPay = 0,
  approvedMobileSpotPay = 0,
  specialReplacementPay = 0,
  positionAllowance = 0,
  extras = {},
} = {}) {
  const money = value => Math.max(0, Number(value || 0));
  const mobileGuaranteeBasis = money(tenurePay) + money(mobilePlanPay) + money(bundle2ndPay)
    + money(vasPay) + money(approvedMobileSpotPay) + money(specialReplacementPay)
    + money(positionAllowance);
  const safeMinimumGuarantee = money(minimumGuarantee);
  const guaranteedComponent = Math.max(safeMinimumGuarantee, mobileGuaranteeBasis);
  const normalizedExtras = Object.fromEntries(
    Object.entries(extras || {}).map(([key, value]) => [key, money(value)])
  );
  const postGuaranteeExtras = Object.values(normalizedExtras).reduce((sum, value) => sum + value, 0);
  const currentPerformanceAmount = mobileGuaranteeBasis + postGuaranteeExtras;
  const closingAmount = guaranteedComponent + postGuaranteeExtras;
  return {
    minimumGuarantee: safeMinimumGuarantee,
    mobileGuaranteeBasis,
    guaranteedComponent,
    guaranteeTopUp: Math.max(0, safeMinimumGuarantee - mobileGuaranteeBasis),
    extras: normalizedExtras,
    postGuaranteeExtras,
    currentPerformanceAmount,
    closingAmount,
    total: closingAmount,
  };
}

const HOME_GRADE_THRESHOLDS = [1, 2, 3, 5, 7, 10];
const HOME_HOUSEHOLD_1G = [250000, 350000, 450000, 550000, 650000, 750000];
const HOME_SOHO_1G = [440000, 540000, 640000, 740000, 840000, 940000];
const HOME_SOHO_500 = [340000, 440000, 540000, 640000, 740000, 840000];
const DEFAULT_HOME_FLAT = [
  { key: 'home1GBOnly', rate: 200000 }, { key: 'home500Only', rate: 100000 },
  { key: 'home100Only', rate: 50000 }, { key: 'tvFree', rate: 100000 },
  { key: 'smartHome', rate: 100000 },
];
const DEFAULT_HOME_ADDON = [
  { key: 'addNewChange', rate: 100000 }, { key: 'addMnp', rate: 300000 },
  { key: 'addUsedMnp', rate: 200000 }, { key: 'addSetTop', rate: 50000 },
  { key: 'smartHomeSimul', rate: 50000 },
];

function homeGradeIndex(totalInternetCount) {
  let index = -1;
  HOME_GRADE_THRESHOLDS.forEach((minimum, i) => {
    if (Number(totalInternetCount || 0) >= minimum) index = i;
  });
  return index;
}

function homeTvGradeRate(totalInternetCount, networkType, speed) {
  const index = homeGradeIndex(totalInternetCount);
  if (index < 0) return 0;
  if (networkType === 'soho') {
    if (speed === '1g') return HOME_SOHO_1G[index];
    if (speed === '500') return HOME_SOHO_500[index];
    return 0;
  }
  if (speed === '1g') return HOME_HOUSEHOLD_1G[index];
  if (speed === '500') return HOME_HOUSEHOLD_1G[index] + 20000;
  return 0;
}

function homeSoloRate(speed) {
  if (speed === '1g') return 200000;
  if (speed === '500') return 100000;
  if (speed === '100') return 50000;
  return 0;
}

function homeSimulType(types) {
  if (types.has('simulUsedMnp')) return 'usedMnp';
  if (types.has('simulMnp')) return 'mnp';
  if (types.has('simulNewChange')) return 'newChange';
  return 'none';
}

export function buildHomeBundlesFromOrders(orders = []) {
  const bundles = new Map();
  (orders || []).filter(order => order?.status === 'completed').forEach(order => {
    const date = String(order.source_work_date || order.actual_install_date || '').slice(0, 10);
    const customerId = String(order.customer_id || '');
    const customer = String(order.customer_name || '이름 없음');
    const key = `${date}|${customerId || customer}`;
    const bundle = bundles.get(key) || {
      key, date, customer, networkType: order.network_type || '',
      saleType: order.sale_type || 'normal', types: new Set(), orders: [],
    };
    bundle.networkType = bundle.networkType || order.network_type || '';
    bundle.saleType = bundle.saleType || order.sale_type || 'normal';
    bundle.types.add(order.product_type);
    bundle.orders.push(order);
    bundles.set(key, bundle);
  });
  return [...bundles.values()].map(bundle => {
    const speed = bundle.types.has('internet1g') ? '1g'
      : bundle.types.has('internet500') ? '500'
        : bundle.types.has('internet100') ? '100' : '';
    return {
      ...bundle, speed, hasInternet: Boolean(speed), hasTv: bundle.types.has('homeTv'),
      simul: homeSimulType(bundle.types),
    };
  });
}

export function calculateHomePolicyFromOrders(orders = [], config = {}) {
  const bundles = buildHomeBundlesFromOrders(orders);
  const internetBundles = bundles.filter(bundle => bundle.hasInternet);
  const totalInternetCount = internetBundles.length;
  const gradeIndex = homeGradeIndex(totalInternetCount);
  const tierMin = gradeIndex >= 0 ? HOME_GRADE_THRESHOLDS[gradeIndex] : 0;
  let gradePay = 0, soloPay = 0, simulPay = 0, tvFreePay = 0;
  let smartHomePay = 0, smartHomeSimulPay = 0, subSetTopPay = 0;
  const details = [];
  const homeFlat = config.homeFlat || DEFAULT_HOME_FLAT;
  const homeAddon = config.homeAddon || DEFAULT_HOME_ADDON;
  const tvFreeRate = Number(homeFlat.find(item => item.key === 'tvFree')?.rate || 0);
  const smartHomeRate = Number(homeFlat.find(item => item.key === 'smartHome')?.rate || 0);
  const smartHomeSimulRate = Number(homeAddon.find(item => item.key === 'smartHomeSimul')?.rate || 0);
  const setTopRate = Number(homeAddon.find(item => item.key === 'addSetTop')?.rate || 0);

  const addAdditionalHomePay = bundle => {
    if (bundle.types.has('tvFree') && tvFreeRate) {
      tvFreePay += tvFreeRate;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: 'TV프리(부)', amount: tvFreeRate, note: '부가 홈 수수료' });
    }
    if (bundle.types.has('smartHome') && smartHomeRate) {
      smartHomePay += smartHomeRate;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '스마트홈', amount: smartHomeRate, note: '부가 홈 수수료' });
    }
    if (bundle.types.has('smartHome') && bundle.simul !== 'none' && smartHomeSimulRate) {
      smartHomeSimulPay += smartHomeSimulRate;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '스마트홈 동시판매', amount: smartHomeSimulRate, note: '스마트홈 + HS 동시판매 추가 수수료' });
    }
    if (bundle.types.has('subSetTop') && setTopRate) {
      subSetTopPay += setTopRate;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '일반 부셋탑', amount: setTopRate, note: '부가 홈 수수료' });
    }
  };

  internetBundles.forEach(bundle => {
    const network = bundle.networkType === 'soho' ? 'soho' : 'household';
    const networkLabel = network === 'soho' ? '소호망' : '가정망';
    const speedLabel = bundle.speed === '1g' ? '1GB' : bundle.speed === '500' ? '500MB' : '100MB';
    if (bundle.saleType === 'allinone') {
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '올인원 홈', amount: 0, note: `${networkLabel} · ${speedLabel} · 인센티브 0원 · 그레이드/성과 인정` });
      return;
    }
    if (bundle.hasTv) {
      const base = homeTvGradeRate(totalInternetCount, network, bundle.speed);
      gradePay += base;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '인터넷+TV 그레이드 수수료', amount: base, note: `${networkLabel} · ${speedLabel} · 총 인터넷 ${totalInternetCount}건 (${tierMin}건 구간)` });
      let additional = 0, item = '';
      if (bundle.simul === 'newChange') { additional = 100000; item = '홈 + HS 신규/기변 동시판매'; }
      else if (bundle.simul === 'mnp') { additional = 300000; item = '홈 + HS MNP 동시판매'; }
      else if (bundle.simul === 'usedMnp' && network === 'household') { additional = 200000; item = '홈 + 중고MNP 동시판매 (85군↑·선약)'; }
      if (additional) {
        simulPay += additional;
        details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item, amount: additional, note: `인터넷+TV · ${networkLabel}` });
      }
    } else {
      const base = homeSoloRate(bundle.speed);
      soloPay += base;
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '인터넷 단독 수수료', amount: base, note: `${networkLabel} · ${speedLabel} · 그레이드 건수에는 포함` });
      if (bundle.simul !== 'none') {
        simulPay += 50000;
        details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '홈 단독 + HS 동시판매', amount: 50000, note: 'HS 가입유형 공통 +5만원' });
      }
    }
    addAdditionalHomePay(bundle);
  });

  bundles.filter(bundle => !bundle.hasInternet).forEach(bundle => {
    if (bundle.saleType === 'allinone') {
      details.push({ date: bundle.date, customer: bundle.customer, type: '홈', item: '올인원 홈', amount: 0, note: `${bundle.networkType === 'soho' ? '소호망' : '가정망'} · 인센티브 0원 · 성과 인정` });
      return;
    }
    addAdditionalHomePay(bundle);
  });

  const homeFlatPay = soloPay + tvFreePay + smartHomePay;
  const homeAddonPay = simulPay + smartHomeSimulPay + subSetTopPay;
  return {
    source: 'orders', totalInternetCount, tierMin, gradePay, soloPay, simulPay,
    tvFreePay, smartHomePay, smartHomeSimulPay, subSetTopPay,
    homeFlatPay, homeAddonPay, total: gradePay + homeFlatPay + homeAddonPay, details,
  };
}

export function allowedSecondVas(items = []) {
  return (items || []).filter(item => SECOND_ALLOWED_VAS_KEYS.includes(item?.key));
}

export function summarizeVasQuality(sales = []) {
  let insurance = 0;
  let strategicVas = 0;
  (sales || []).forEach(sale => {
    const meta = sale?.source_meta || {};
    const keys = [...(meta.vasKeys || []), ...Object.values(meta.bundleVasMap || {}).flat()];
    keys.forEach(key => {
      if (key === 'vasPhonePass' || key === 'vasSafePass') insurance += 1;
      if (key === 'vasKyobo' || key === 'vasVcolor') strategicVas += 1;
    });
  });
  return { insurance, strategicVas, insurancePoints: insurance * INSURANCE_QUALITY_POINT };
}

export function calculateFreePhoneSpecialOutcome({
  planIncentive = 0,
  vasIncentive = 0,
  insuranceIncentive = 0,
  secondIncentive = 0,
  approvedSpotIncentive = 0,
  isFreePhoneSpecial = false,
} = {}) {
  const requested = {
    plan: Math.max(0, Number(planIncentive || 0)),
    vas: Math.max(0, Number(vasIncentive || 0)),
    insurance: Math.max(0, Number(insuranceIncentive || 0)),
    second: Math.max(0, Number(secondIncentive || 0)),
    spot: Math.max(0, Number(approvedSpotIncentive || 0)),
  };
  const paid = isFreePhoneSpecial
    ? { ...requested, plan: 0, vas: 0, insurance: 0 }
    : requested;
  return {
    requested,
    paid,
    excluded: {
      plan: requested.plan - paid.plan,
      vas: requested.vas - paid.vas,
      insurance: requested.insurance - paid.insurance,
    },
    total: Object.values(paid).reduce((sum, value) => sum + value, 0),
    countsAsPerformance: true,
    countsAsActivitySupport: true,
  };
}

export function summarizeHomeStatuses(orders = [], month) {
  const monthRows = (orders || []).filter(order => {
    const dateMonth = String(order?.source_work_date || order?.actual_install_date || '').slice(0, 7);
    return dateMonth === month && order?.status !== 'cancelled';
  });
  const bundleKey = row => {
    const date = String(row?.source_work_date || row?.actual_install_date || '').slice(0, 10);
    return `${date}|${row?.customer_id || row?.customer_name || row?.id}`;
  };
  const uniqueCount = rows => new Set(rows.map(bundleKey)).size;
  const completedRows = monthRows.filter(row => row?.status === 'completed');
  const pendingRows = monthRows.filter(row => row?.status === 'pending');
  return {
    rows: monthRows,
    completedRows,
    pendingRows,
    completedCount: uniqueCount(completedRows),
    pendingCount: uniqueCount(pendingRows),
    totalCount: uniqueCount(monthRows),
  };
}
