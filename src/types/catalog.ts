export interface CalotaVariant {
  diameterMm: string;
  commercialCode: string;
  boxNumber: string;
  rawLine?: string;
}

export interface EmblemProduct {
  id: string;
  name: string;
  catalogSource: string;
  category: string;
  categorySlug: string;
  brand: string;
  boxNumber: string;
  commercialCode: string;
  referenceCode: string;
  marconCode?: string;
  julijacCode?: string;
  diameterMm: string;
  position: string;
  finish: string;
  vehicleApplication: string;
  description: string;
  needsDescriptionReview: boolean;
  images: string[];
  variants?: CalotaVariant[];
  allBoxes?: string[];
  allDiameters?: string[];
  allCodes?: string[];
  priceCents?: number; // Preço em centavos para precisão monetária exata
  notes?: string;
  searchTokens: string;
  customPastedImages?: string[];
  lastModified?: number;
}

export type ViewMode = 'grid' | 'mural';
export type ThemeMode = 'light' | 'dark';

export interface FilterState {
  searchQuery: string;
  selectedCategory: string; // 'todos' ou categorySlug
  selectedBrand: string;
  selectedPosition: string;
  selectedDiameter: string;
  statusFilter: 'all' | 'needs_review' | 'has_description' | 'with_variants';
  hidePrices: boolean;
  viewMode: ViewMode;
}

export interface BackupData {
  version: string;
  exportDate: string;
  totalProducts: number;
  products: EmblemProduct[];
  sha256: string;
}

