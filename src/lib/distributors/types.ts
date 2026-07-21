export type DistributorKey =
  | "INGRAM_MICRO"
  | "TD_SYNNEX"
  | "DH"
  | "AMAZON_BUSINESS"

export interface DistributorCredentials {
  apiKey: string
  clientId: string
  clientSecret: string
  partnerId: string
}

export interface DistributorSearchResult {
  name: string
  manufacturer: string
  partNumber: string
  sku: string
  msrp: number
  cost: number
  stock: number
  leadTime: string
  distributor: DistributorKey
  isMock: boolean
}

export interface TestConnectionResult {
  success: boolean
  status: string
}

export interface DistributorAdapter {
  key: DistributorKey
  label: string
  /**
   * Flip to true once this distributor's API access is approved AND the
   * real fetch calls inside this adapter's testConnection/search have
   * been filled in. Until then, everything routes to mock data.
   */
  isLive: boolean
  testConnection(creds: DistributorCredentials): Promise<TestConnectionResult>
  search(
    query: string,
    creds: DistributorCredentials
  ): Promise<DistributorSearchResult[]>
}