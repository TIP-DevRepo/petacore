import { DistributorAdapter, DistributorKey } from "./types"
import { ingramMicroAdapter } from "./ingram-micro"
import { tdSynnexAdapter } from "./td-synnex"
import { dhAdapter } from "./dh"
import { amazonBusinessAdapter } from "./amazon-business"

export const distributorAdapters: Record<DistributorKey, DistributorAdapter> = {
  INGRAM_MICRO: ingramMicroAdapter,
  TD_SYNNEX: tdSynnexAdapter,
  DH: dhAdapter,
  AMAZON_BUSINESS: amazonBusinessAdapter,
}

export function getAdapter(key: DistributorKey): DistributorAdapter {
  return distributorAdapters[key]
}