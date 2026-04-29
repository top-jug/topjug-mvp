import { GymSearchItem, RegionMap } from '../entities/gym/types';

export const GYM_SEARCH_SUB_REGIONS: RegionMap = {
  '서울': ['종로', '신촌', '성수', '강남', '홍대', '건대', '사당', '신림', '노원', '송파'],
  '경기': ['수원', '성남', '고양', '용인', '부천', '안산', '남양주', '화성', '평택', '의정부'],
  '인천': ['남동구', '부평구', '연수구', '서구', '계양구', '중구'],
};

export const GYM_SEARCH_REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종'];

export const GYM_SEARCH_TABS = ['전체', '샤워실', '킬터보드', '스트레칭', '주차가능'];

export const GYM_SEARCH_ITEMS: GymSearchItem[] = [
  { id: 1, name: '볼더팜', description: '서울 강남구 강남대로 362 강남역 인근', tags: ['클라이밍장'], distance: '1.2km', image: 'https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400&h=300&fit=crop' },
  { id: 2, name: '김대리', description: '경기도 안양 만안구 삼덕로 사당역', tags: ['클라이밍장'], distance: '4.2km', image: 'https://images.unsplash.com/photo-1564415637254-92c66292cd64?w=400&h=300&fit=crop' },
  { id: 3, name: '홀드업', description: 'CGV 센트럴 클라이밍 클라이밍 롤코', tags: ['클라이밍장', '카페'], distance: '6.4km', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop' },
  { id: 4, name: '부산대바위', description: '부산 금정구 부산대학로 락클라이밍 장소', tags: ['클라이밍', '초급자'], distance: '9.5km', image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=300&fit=crop' },
  { id: 5, name: '신림암장', description: '서울 관악구 신림로 관악산 인근 암장', tags: ['봉우리', '초급자'], distance: '3.5km', image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=400&h=300&fit=crop' },
  { id: 6, name: '신도림역', description: '7호선 신도림역 근처 신규 암장 개업', tags: ['시설별', '할인행사'], distance: '7.5km', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop' },
];
