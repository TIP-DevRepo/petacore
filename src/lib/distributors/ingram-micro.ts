import {
  DistributorAdapter,
  DistributorCredentials,
  DistributorSearchResult,
  TestConnectionResult,
} from "./types"
import XiSdkResellers from "xi_sdk_resellers"

// TIPINC is US-based — change this if that's ever not true
const COUNTRY_CODE = "US"

function getBasePath(sandboxMode: boolean) {
  return sandboxMode
    ? "https://api.ingrammicro.com:443/sandbox"
    : "https://api.ingrammicro.com:443"
}

async function getAccessToken(
  creds: DistributorCredentials,
  _sandboxMode: boolean
): Promise<string> {
  const client = new XiSdkResellers.ApiClient()
  client.basePath = "https://api.ingrammicro.com:443"
  const api = new XiSdkResellers.AccesstokenApi(client)

  return new Promise((resolve, reject) => {
    api.getAccesstoken(
      "client_credentials",
      creds.clientId,
      creds.clientSecret,
      (error: unknown, data: { access_token?: string }) => {
        if (error || !data?.access_token) {
          reject(error ?? new Error("No access token returned"))
        } else {
          resolve(data.access_token)
        }
      }
    )
  })
}

export const ingramMicroAdapter: DistributorAdapter = {
  key: "INGRAM_MICRO",
  label: "Ingram Micro",
  isLive: true,

  async testConnection(
    creds: DistributorCredentials,
    sandboxMode = true
  ): Promise<TestConnectionResult> {
    try {
      await getAccessToken(creds, sandboxMode)
      return {
        success: true,
        status: `Connected (${sandboxMode ? "Sandbox" : "Production"})`,
      }
    } catch (err) {
      return {
        success: false,
        status: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      }
    }
  },

  async search(
    query: string,
    creds: DistributorCredentials,
    sandboxMode = true
  ): Promise<DistributorSearchResult[]> {
    const accessToken = await getAccessToken(creds, sandboxMode)

    const client = new XiSdkResellers.ApiClient()
    client.basePath = getBasePath(sandboxMode)
    client.authentications["application"].accessToken = accessToken
    const api = new XiSdkResellers.ProductCatalogApi(client)

    // apiKey field is repurposed to store the IM Customer Number
    // (Ingram doesn't use a separate "API key" concept)
    const imCustomerNumber = creds.apiKey
    const imCorrelationID = crypto.randomUUID().replace(/-/g, "")

    return new Promise((resolve, reject) => {
      api.getResellerV6Productsearch(
        imCustomerNumber,
        imCorrelationID,
        COUNTRY_CODE,
        { pageNumber: 1, pageSize: 10, keyword: [query] },
        (error: unknown, data: { catalog?: Array<Record<string, unknown>> }) => {
          if (error) {
            reject(error)
            return
          }
          const items = (data?.catalog ?? []).map((item) => ({
            name: String(item.description ?? item.productName ?? "Unknown item"),
            manufacturer: String(item.vendorName ?? ""),
            partNumber: String(item.vendorPartNumber ?? ""),
            sku: String(item.ingramPartNumber ?? ""),
            msrp: Number(item.retailPrice ?? 0),
            cost: Number(item.customerPrice ?? 0),
            stock: 0, // filled in by a follow-up price/availability call — see note below
            leadTime: "Check availability",
            distributor: "INGRAM_MICRO" as const,
            isMock: false,
          }))
          resolve(items)
        }
      )
    })
  },
}