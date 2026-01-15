import { Codex } from "@codex-data/sdk";

export const getCodexClient = () => {
  const apiKey = import.meta.env.VITE_CODEX_API_KEY;
  if (!apiKey) {
    throw new Error("VITE_CODEX_API_KEY is not set");
  }
  return new Codex(apiKey);
};

// Pair with metadata 类型定义
export interface PairWithMetadata {
  pair: {
    address: string;
    token0: string;
    token1: string;
    createdAt?: number;
  };
  exchange: {
    address: string;
    name: string;
    iconUrl?: string;
    tradeUrl?: string;
  };
  liquidity?: string;
  volume?: string;
}

/**
 * 获取代币的所有交易对（带元数据）
 */
export async function listPairsWithMetadataForToken(
  tokenAddress: string,
  networkId: number,
  limit: number = 50
): Promise<PairWithMetadata[]> {
  try {
    const codexClient = getCodexClient();
    const param = { tokenAddress, networkId, limit };
    
    console.log("[Codex] listPairsWithMetadataForToken:", param);
    
    const response = await codexClient.queries.listPairsWithMetadataForToken(param);
    const results = (response as { listPairsWithMetadataForToken?: { results?: PairWithMetadata[] } })
      ?.listPairsWithMetadataForToken?.results || [];
    
    console.log("[Codex] listPairsWithMetadataForToken returned:", results.length, "pairs");
    
    return results;
  } catch (error) {
    console.error("[Codex] listPairsWithMetadataForToken error:", error);
    return [];
  }
}

// 有效的交易所列表（只支持 Raydium CPMM）
export const VALID_EXCHANGES = [
  "Raydium CPMM",
];
