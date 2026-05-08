export type AssetResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};

export type AssetDetails = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  type: string;
  price?: number;
  dayHigh?: number;
  dayLow?: number;
  timestampISO?: string;
};
