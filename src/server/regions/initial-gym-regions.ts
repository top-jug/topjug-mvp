export const INITIAL_GYM_REGION_BY_EXTERNAL_ID = {
  '2e164c716034d6a1379b3871a6aa011c': '41285', // 더클라임 일산, 고양시 일산동구
  cd09bb3588f0ecca77f5f581e459f3ac: '11500', // 더클라임 마곡, 강서구
  '9a6583aebb3703c0e8fa914506403842': '11680', // 더클라임 양재, 강남구
  '0889e0647df7851978ea2484f14a97bd': '11620', // 더클라임 신림, 관악구
  '2d4bbe3c02f72c07d83c3872863ca23f': '11440', // 더클라임 연남, 마포구
  '50656c96e6db48670d2f7013095a5740': '11680', // 더클라임 강남, 강남구
  '1488f92d278357e800a8872640815641': '11620', // 더클라임 사당, 관악구
  bf7ce40006bc6c3d5e45f695d1d45399: '11650', // 더클라임 논현, 서초구
  '8045f0b60419f68653385d938267b8fe': '11560', // 더클라임 문래, 영등포구
  '8fa0ab115e8fc1cc2f73e325ab8c9225': '11590', // 더클라임 이수, 동작구
  aca480c5538eb38eba68e19ace430b2a: '11200', // 더클라임 성수, 성동구
  c9aef32e4c8c1d2414c891246e255c74: '11410', // 담장 신촌, 서대문구
  '8af0239e7e5f9660eb74522da1d6ec9d': '11140', // 담장 을지로, 중구
  '99ecd1f73bb3db9c061c95d90226550a': '11410', // 피커스 신촌, 서대문구
  '2bd83309691eaecef7e8302f0ebce86a': '11110', // 피커스 종로, 종로구
  '305dcfac596ee713533856fbe23eb529': '11530', // 피커스 구로, 구로구
  '47e9f3c5872306953562ab38eaf41555': '11530', // 서울숲 구로, 구로구
  '656f829ce20960af4db592cb39ce6d75': '11710', // 서울숲 잠실, 송파구
  c1545f85444704611c91436a87607aee: '11110', // 서울숲 종로, 종로구
  '5f60c0e2393a7a18afc1c5e2fe41aaed': '11560', // 서울숲 영등포, 영등포구
  '28f58f7b746f9dff044b4e3c544f89dc': '11680', // 클라이밍파크 강남, 강남구
  '968663321a97e9b577a5fced0ed4e4a2': '11200', // 클라이밍파크 성수, 성동구
  a2ba658d6576d9a92d60b214e72b38e6: '11680', // 클라이밍파크 신논현, 강남구
  '8ec1f259ddea4f6c484098d44ac5fd2a': '11110', // 클라이밍파크 종로, 종로구
  '81a8c8f5431fac4bfd38e5185962000e': '11680', // 클라이밍파크 한티, 강남구
  f00e9041f6a05d840c156512d1573733: '11650', // 손상원 강남, 서초구
  b93c66b6e19186b17b59cf576b3f59bd: '41135', // 손상원 판교, 성남시 분당구
  '7e890d64bc73e7ff8947fdf985a4833e': '11140', // 손상원 을지로, 중구
  '685c80ed2a2d15b49c6de95a0cddfe3d': '11740', // 알레 강동, 강동구
  '6892b9026d056ed71fbc08405f95758c': '11560', // 알레 영등포, 영등포구
  ac3193b969ca0091827bab509519c07a: '11110', // 알레 혜화, 종로구
} as const;

export function initialGymRegionCode(externalId: string) {
  return (INITIAL_GYM_REGION_BY_EXTERNAL_ID as Record<string, string>)[externalId];
}

export function assignInitialGymRegions<T extends { externalId: string; location: string }>(rows: T[]) {
  const seen = new Set<string>();
  const duplicateSourceIds: string[] = [];
  const assigned = rows.map((row) => {
    if (seen.has(row.externalId)) duplicateSourceIds.push(row.externalId);
    seen.add(row.externalId);
    return { ...row, regionCode: initialGymRegionCode(row.externalId) };
  });
  const missing = assigned.filter((row) => !row.regionCode).map((row) => row.location);
  const unexpected = Object.keys(INITIAL_GYM_REGION_BY_EXTERNAL_ID).filter((externalId) => !seen.has(externalId));

  if (duplicateSourceIds.length > 0) throw new Error(`Duplicate source IDs in region mapping input: ${duplicateSourceIds.join(', ')}`);
  if (missing.length > 0) throw new Error(`Missing region mappings: ${missing.join(', ')}`);
  if (unexpected.length > 0) throw new Error(`Region mappings without imported gyms: ${unexpected.join(', ')}`);
  return assigned as Array<T & { regionCode: string }>;
}
