import { RegionMap } from '../../entities/gym/types';

export const GYM_SEARCH_SUB_REGIONS: RegionMap = {
  서울: ['종로', '신촌', '성수', '강남', '홍대', '건대', '사당', '신림', '노원', '송파'],
  경기: ['수원', '성남', '고양', '용인', '부천', '안산', '남양주', '화성', '평택', '의정부'],
  인천: ['남동구', '부평구', '연수구', '서구', '계양구', '중구'],
};

export const GYM_SEARCH_REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종'];
export const GYM_SEARCH_TABS = ['전체', '샤워실', '킬터보드', '스트레칭', '주차가능'];
