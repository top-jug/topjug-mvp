export interface GymSearchItem {
  id: number;
  name: string;
  description: string;
  tags: string[];
  distance: string;
  image: string;
  address?: string;
}

export type RegionMap = Record<string, string[]>;

export interface GymFacility {
  label: string;
  icon: 'shower' | 'boulder' | 'stretch' | 'parking';
}
