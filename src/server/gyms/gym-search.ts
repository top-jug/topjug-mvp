const CANONICAL_ADMIN_NAMES = new Map([
  ['서울특별시', '서울'],
  ['서울시', '서울'],
  ['경기도', '경기'],
  ['인천광역시', '인천'],
  ['부산광역시', '부산'],
  ['대구광역시', '대구'],
  ['광주광역시', '광주'],
  ['대전광역시', '대전'],
  ['울산광역시', '울산'],
  ['세종특별자치시', '세종'],
  ['강원특별자치도', '강원'],
  ['강원도', '강원'],
  ['충청북도', '충북'],
  ['충청남도', '충남'],
  ['전북특별자치도', '전북'],
  ['전라북도', '전북'],
  ['전라남도', '전남'],
  ['경상북도', '경북'],
  ['경상남도', '경남'],
  ['제주특별자치도', '제주'],
]);

const ADMIN_SUFFIXES = ['특별자치시', '특별자치도', '광역시', '특별시', '자치구', '시', '군', '구', '도'];

function normalizeAdminToken(token: string) {
  let normalized = CANONICAL_ADMIN_NAMES.get(token) ?? token;

  for (const suffix of ADMIN_SUFFIXES) {
    if (normalized.length > suffix.length + 1 && normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, -suffix.length);
      break;
    }
  }

  return CANONICAL_ADMIN_NAMES.get(normalized) ?? normalized;
}

export function normalizeGymSearchTokens(query: string | null | undefined) {
  return [...new Set(
    (query ?? '')
      .trim()
      .split(/\s+/)
      .map((token) => normalizeAdminToken(token.toLowerCase()))
      .filter(Boolean),
  )];
}

