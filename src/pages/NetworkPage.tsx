import { Codex } from "@codex-data/sdk";
import { TokenRankingAttribute, RankingDirection, TokenFilterResult } from "@codex-data/sdk/dist/sdk/generated/graphql";
import { Link, useParams } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { VALID_EXCHANGES } from "@/lib/codex";
import { RAYDIUM_CPMM_PROGRAM_ID } from "@/lib/raydiumCpmm";

// WSOL 地址
const WSOL_ADDRESS = "So11111111111111111111111111111111111111112";

// 检查代币是否支持 CPMM 交易
function hasCPMMExchange(token: TokenFilterResult['token']): boolean {
  if (!token?.exchanges || token.exchanges.length === 0) return false;
  return token.exchanges.some(exchange => 
    exchange.name && VALID_EXCHANGES.some(validName => 
      exchange.name?.toLowerCase().includes(validName.toLowerCase())
    )
  );
}

export default function NetworkPage() {
  const { networkId } = useParams<{ networkId: string }>();
  const networkIdNum = parseInt(networkId || '', 10);

  const [tokenListItems, setTokenListItems] = useState<TokenFilterResult[]>([]);
  const [networkName, setNetworkName] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'cpmm'>('cpmm'); // 默认只显示 CPMM
  const [sortMode, setSortMode] = useState<'liquidity' | 'trending'>('liquidity'); // 默认按流动性排序

  useEffect(() => {
    if (isNaN(networkIdNum)) {
      setFetchError("Invalid Network ID");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      const apiKey = import.meta.env.VITE_CODEX_API_KEY;
      if (!apiKey) {
        console.warn("VITE_CODEX_API_KEY environment variable is not set.");
      }
      const codexClient = new Codex(apiKey || '');

      try {
        const [networksResult, tokensResponse] = await Promise.all([
          codexClient.queries.getNetworks({})
            .catch((err: Error) => {
              console.error(`Error fetching all networks:`, err);
              return null;
            }),
          codexClient.queries.filterTokens({
            filters: { 
              network: [networkIdNum],
              // 最低流动性过滤：至少 $1000 流动性
              liquidity: { gte: 1000 },
            },
            rankings: [{
              attribute: sortMode === 'liquidity' 
                ? TokenRankingAttribute.Liquidity 
                : TokenRankingAttribute.TrendingScore,
              direction: RankingDirection.Desc
            }],
            limit: 100,
          }).catch((err: Error) => {
            console.error(`Error fetching tokens for network ${networkIdNum}:`, err);
            throw new Error(`Failed to load tokens for network ${networkIdNum}.`);
          })
        ]);

        if (networksResult?.getNetworks) {
          const currentNetwork = networksResult.getNetworks.find(net => net.id === networkIdNum);
          setNetworkName(currentNetwork?.name || `Network ${networkId}`);
        } else {
          setNetworkName(`Network ${networkId}`);
        }

        const resultsArray = tokensResponse.filterTokens?.results;
        if (resultsArray) {
          const filteredItems = resultsArray
            .filter((item): item is TokenFilterResult => item != null && item.token != null);
          setTokenListItems(filteredItems);
        }

      } catch (err: unknown) {
        console.error("Error loading network page data:", err);
        if (err instanceof Error) {
          setFetchError(err.message);
        } else {
          setFetchError("An unknown error occurred while loading page data.");
        }
        if (!networkName) setNetworkName(`Network ${networkId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [networkIdNum, networkId, networkName, sortMode]);

  // 过滤后的代币列表
  const filteredTokens = useMemo(() => {
    if (filterMode === 'all') return tokenListItems;
    return tokenListItems.filter(item => hasCPMMExchange(item.token));
  }, [tokenListItems, filterMode]);

  // 统计 CPMM 代币数量
  const cpmmCount = useMemo(() => {
    return tokenListItems.filter(item => hasCPMMExchange(item.token)).length;
  }, [tokenListItems]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center p-12 md:p-24">
        <p>Loading...</p>
      </main>
    );
  }

  const pageTitle = fetchError && !tokenListItems.length ? `Error loading tokens for ${networkName}` : networkName || `Tokens on Network ${networkId}`;

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12">
      <div className="w-full max-w-6xl flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
        <Link to="/" className="hover:underline">&lt; Back to Networks</Link>
      </div>

      <div className="w-full max-w-6xl">
        {fetchError && <p className="text-destructive mb-4">{fetchError}</p>}

        {/* 过滤器和排序控制栏 */}
        <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
          {/* 过滤器 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setFilterMode('cpmm')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterMode === 'cpmm'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                ✓ CPMM ({cpmmCount})
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  filterMode === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                All ({tokenListItems.length})
              </button>
            </div>
          </div>

          {/* 分隔线 */}
          <div className="h-6 w-px bg-border" />

          {/* 排序 */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setSortMode('liquidity')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortMode === 'liquidity'
                    ? 'bg-green-600 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                💰 Liquidity
              </button>
              <button
                onClick={() => setSortMode('trending')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  sortMode === 'trending'
                    ? 'bg-orange-600 text-white'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                🔥 Trending
              </button>
            </div>
          </div>

          {/* 说明文字 */}
          <span className="text-xs text-muted-foreground ml-auto">
            {loading ? 'Loading...' : `Min $1,000 liquidity • Sorted by ${sortMode === 'liquidity' ? 'highest liquidity' : 'trending score'}`}
          </span>
        </div>

        {!fetchError || tokenListItems.length > 0 ? (
          <>
            {filteredTokens.length === 0 && !fetchError && (
              <div className="text-center py-8 text-muted-foreground">
                {filterMode === 'cpmm' 
                  ? 'No CPMM-tradeable tokens found. Try switching to "All" filter.'
                  : 'Loading tokens or no tokens found...'}
              </div>
            )}
            {filteredTokens.length > 0 && (
              <table className="w-full table-auto border-collapse border border-border">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 text-left font-semibold w-[60px]">Icon</th>
                    <th className="p-2 text-left font-semibold w-[200px]">Name</th>
                    <th className="p-2 text-left font-semibold w-[120px]">Symbol</th>
                    <th className="p-2 text-left font-semibold w-[100px]">Trade</th>
                    <th className="p-2 text-left font-semibold">Exchanges</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTokens.map((item) => {
                    const isCPMM = hasCPMMExchange(item.token);
                    return (
                      <tr 
                        key={item.token?.address} 
                        className={`border-b border-dashed border-border/30 hover:bg-muted/30 ${
                          isCPMM ? 'bg-green-500/5' : ''
                        }`}
                      >
                        <td className="p-2 flex items-center justify-center">
                          {item.token?.info?.imageThumbUrl ? (
                            <img
                              src={item.token?.info?.imageThumbUrl}
                              alt={`${item.token?.name || 'Token'} icon`}
                              width={24}
                              height={24}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                              {item.token?.symbol ? item.token.symbol[0] : 'T'}
                            </div>
                          )}
                        </td>
                        <td className="p-2 truncate">
                          <Link 
                            to={`/networks/${networkId}/tokens/${item.token?.address}`} 
                            className="block w-full h-full hover:text-primary"
                          >
                            {item.token?.name || "Unknown Name"}
                          </Link>
                        </td>
                        <td className="p-2 truncate">
                          <Link 
                            to={`/networks/${networkId}/tokens/${item.token?.address}`} 
                            className="block w-full h-full hover:text-primary"
                          >
                            {item.token?.symbol || "-"}
                          </Link>  
                        </td>
                        <td className="p-2">
                          {isCPMM ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                              ✓ CPMM
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-2">
                          <Link 
                            to={`/networks/${networkId}/tokens/${item.token?.address}`} 
                            className="block w-full h-full text-sm"
                          >
                            {item.token?.exchanges?.map((exchange, idx) => (
                              <span 
                                key={idx}
                                className={`inline-block mr-1 mb-1 px-1.5 py-0.5 rounded text-xs ${
                                  exchange.name && VALID_EXCHANGES.some(v => 
                                    exchange.name?.toLowerCase().includes(v.toLowerCase())
                                  )
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {exchange.name || 'Unknown'}
                              </span>
                            )) || "-"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}