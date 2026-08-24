export type RegionMap = Record<string, string[]>;

export interface GymFacility {
  label: string;
  icon: 'shower' | 'boulder' | 'stretch' | 'parking' | 'rental';
}
