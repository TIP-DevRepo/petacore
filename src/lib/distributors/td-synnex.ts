import {
  DistributorAdapter,
  DistributorCredentials,
  DistributorSearchResult,
  TestConnectionResult,
} from "./types"
import { generateMockResults } from "./mock-data"

export const tdSynnexAdapter: DistributorAdapter = {
  key: "TD_SYNNEX",
  label: "TD Synnex",
  isLive: false,

  async testConnection(creds: DistributorCredentials): Promise<TestConnectionResult> {
    // TODO once approved: TD Synnex REST API call using apiKey + partnerId
    // in the request headers to confirm access.
    return {
      success: false,
      status: "TD Synnex adapter is built but not live yet — waiting on API account approval.",
    }
  },

  async search(query: string, _creds: DistributorCredentials): Promise<DistributorSearchResult[]> {
    // TODO once approved: call TD Synnex's product search endpoint with apiKey + partnerId,
    // then map the response into DistributorSearchResult objects.
    return generateMockResults(query, "TD_SYNNEX")
  },
}