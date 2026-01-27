export interface PromoStandardsColor {
  colorName: string;
  hex?: string;
  approximatePmsColor?: string;
  standardColorName?: string;
}

export interface PromoStandardsPartId {
  partId: string;
  colorName: string;
  colorArray: PromoStandardsColor[];
}

export interface PromoStandardsProduct {
  productId: string;
  productName: string;
  description?: string;
  productBrand?: string;
  partIdArray: PromoStandardsPartId[];
}

export interface PromoStandardsPrice {
  minQuantity: number;
  price: number;
  discountCode?: string;
  priceEffectiveDate?: string;
  priceExpiryDate?: string;
}

export interface PromoStandardsPricing {
  partId: string;
  priceArray: PromoStandardsPrice[];
  currency?: string;
}

export interface PromoStandardsInventory {
  partId: string;
  quantityAvailable: {
    quantity: number;
    postalCode?: string;
  }[];
}

export interface PromoStandardsMedia {
  partId: string;
  mediaContent: {
    url: string;
    mediaType: string;
    classType?: string;
    description?: string;
    fileSize?: number;
    width?: number;
    height?: number;
  }[];
}

export interface SSActivewearCredentials {
  accountNumber: string;
  apiKey: string;
}
