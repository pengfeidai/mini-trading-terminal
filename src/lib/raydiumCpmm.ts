import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  AccountMeta,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeAccountInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  ACCOUNT_SIZE,
} from "@solana/spl-token";
import BN from "bn.js";

// Token account rent exemption (约 0.00203928 SOL)
const TOKEN_ACCOUNT_RENT = 2039280;

// Raydium CPMM Program ID
export const RAYDIUM_CPMM_PROGRAM_ID = new PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
);

// Raydium CPMM Authority (hardcoded, same as SDK)
export const RAYDIUM_CPMM_AUTHORITY = new PublicKey(
  "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL"
);

// swap_base_input instruction discriminator
const SWAP_BASE_INPUT_DISCRIMINATOR = Buffer.from([
  143, 190, 90, 218, 196, 30, 51, 222,
]);

// Pool state account layout offsets
const POOL_STATE_LAYOUT = {
  AMM_CONFIG: 8, // offset after discriminator
  POOL_CREATOR: 40,
  TOKEN_0_VAULT: 72,
  TOKEN_1_VAULT: 104,
  LP_MINT: 136,
  TOKEN_0_MINT: 168,
  TOKEN_1_MINT: 200,
  TOKEN_0_PROGRAM: 232,
  TOKEN_1_PROGRAM: 264,
  OBSERVATION_KEY: 296,
  AUTH_BUMP: 328,
  STATUS: 329,
  LP_MINT_DECIMALS: 330,
  MINT_0_DECIMALS: 331,
  MINT_1_DECIMALS: 332,
  LP_SUPPLY: 333,
  PROTOCOL_FEES_TOKEN_0: 341,
  PROTOCOL_FEES_TOKEN_1: 349,
  FUND_FEES_TOKEN_0: 357,
  FUND_FEES_TOKEN_1: 365,
  OPEN_TIME: 373,
};

export interface PoolState {
  address: PublicKey;
  ammConfig: PublicKey;
  poolCreator: PublicKey;
  token0Vault: PublicKey;
  token1Vault: PublicKey;
  lpMint: PublicKey;
  token0Mint: PublicKey;
  token1Mint: PublicKey;
  token0Program: PublicKey;
  token1Program: PublicKey;
  observationKey: PublicKey;
  authBump: number;
  status: number;
  lpMintDecimals: number;
  mint0Decimals: number;
  mint1Decimals: number;
  lpSupply: BN;
  protocolFeesToken0: BN;
  protocolFeesToken1: BN;
  fundFeesToken0: BN;
  fundFeesToken1: BN;
  openTime: BN;
}

export interface VaultBalances {
  vault0Balance: BN;
  vault1Balance: BN;
}

export interface SwapQuote {
  amountIn: BN;
  amountOut: BN;
  minimumAmountOut: BN;
  priceImpact: number;
  inputMint: PublicKey;
  outputMint: PublicKey;
}

/**
 * Parse pool state from account data
 */
export function parsePoolState(
  address: PublicKey,
  data: Buffer
): PoolState {
  return {
    address,
    ammConfig: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.AMM_CONFIG, POOL_STATE_LAYOUT.AMM_CONFIG + 32)
    ),
    poolCreator: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.POOL_CREATOR, POOL_STATE_LAYOUT.POOL_CREATOR + 32)
    ),
    token0Vault: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_0_VAULT, POOL_STATE_LAYOUT.TOKEN_0_VAULT + 32)
    ),
    token1Vault: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_1_VAULT, POOL_STATE_LAYOUT.TOKEN_1_VAULT + 32)
    ),
    lpMint: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.LP_MINT, POOL_STATE_LAYOUT.LP_MINT + 32)
    ),
    token0Mint: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_0_MINT, POOL_STATE_LAYOUT.TOKEN_0_MINT + 32)
    ),
    token1Mint: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_1_MINT, POOL_STATE_LAYOUT.TOKEN_1_MINT + 32)
    ),
    token0Program: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_0_PROGRAM, POOL_STATE_LAYOUT.TOKEN_0_PROGRAM + 32)
    ),
    token1Program: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.TOKEN_1_PROGRAM, POOL_STATE_LAYOUT.TOKEN_1_PROGRAM + 32)
    ),
    observationKey: new PublicKey(
      data.subarray(POOL_STATE_LAYOUT.OBSERVATION_KEY, POOL_STATE_LAYOUT.OBSERVATION_KEY + 32)
    ),
    authBump: data[POOL_STATE_LAYOUT.AUTH_BUMP],
    status: data[POOL_STATE_LAYOUT.STATUS],
    lpMintDecimals: data[POOL_STATE_LAYOUT.LP_MINT_DECIMALS],
    mint0Decimals: data[POOL_STATE_LAYOUT.MINT_0_DECIMALS],
    mint1Decimals: data[POOL_STATE_LAYOUT.MINT_1_DECIMALS],
    lpSupply: new BN(
      data.subarray(POOL_STATE_LAYOUT.LP_SUPPLY, POOL_STATE_LAYOUT.LP_SUPPLY + 8),
      "le"
    ),
    protocolFeesToken0: new BN(
      data.subarray(
        POOL_STATE_LAYOUT.PROTOCOL_FEES_TOKEN_0,
        POOL_STATE_LAYOUT.PROTOCOL_FEES_TOKEN_0 + 8
      ),
      "le"
    ),
    protocolFeesToken1: new BN(
      data.subarray(
        POOL_STATE_LAYOUT.PROTOCOL_FEES_TOKEN_1,
        POOL_STATE_LAYOUT.PROTOCOL_FEES_TOKEN_1 + 8
      ),
      "le"
    ),
    fundFeesToken0: new BN(
      data.subarray(
        POOL_STATE_LAYOUT.FUND_FEES_TOKEN_0,
        POOL_STATE_LAYOUT.FUND_FEES_TOKEN_0 + 8
      ),
      "le"
    ),
    fundFeesToken1: new BN(
      data.subarray(
        POOL_STATE_LAYOUT.FUND_FEES_TOKEN_1,
        POOL_STATE_LAYOUT.FUND_FEES_TOKEN_1 + 8
      ),
      "le"
    ),
    openTime: new BN(
      data.subarray(POOL_STATE_LAYOUT.OPEN_TIME, POOL_STATE_LAYOUT.OPEN_TIME + 8),
      "le"
    ),
  };
}


/**
 * Fetch pool state by address directly (fast, single RPC call)
 */
export async function getPoolStateByAddress(
  connection: Connection,
  poolAddress: PublicKey
): Promise<PoolState | null> {
  console.log("[Raydium] Fetching pool state by address:", poolAddress.toBase58());
  const startTime = Date.now();
  
  try {
    const accountInfo = await connection.getAccountInfo(poolAddress);
    
    if (!accountInfo) {
      console.log("[Raydium] Pool account not found");
      return null;
    }
    
    if (accountInfo.owner.toBase58() !== RAYDIUM_CPMM_PROGRAM_ID.toBase58()) {
      console.log("[Raydium] Account is not owned by CPMM program");
      return null;
    }
    
    const poolState = parsePoolState(poolAddress, accountInfo.data as Buffer);
    console.log("[Raydium] Pool state fetched in", Date.now() - startTime, "ms");
    console.log("[Raydium] Pool token0:", poolState.token0Mint.toBase58());
    console.log("[Raydium] Pool token1:", poolState.token1Mint.toBase58());
    console.log("[Raydium] Pool status:", poolState.status);
    
    return poolState;
  } catch (error) {
    console.error("[Raydium] Error fetching pool state:", error);
    return null;
  }
}

/**
 * Find CPMM pool by token pair using getProgramAccounts with memcmp filters
 * Uses RPC-side filtering for much faster results
 */
export async function findPoolByTokenPair(
  connection: Connection,
  tokenA: PublicKey,
  tokenB: PublicKey
): Promise<PoolState | null> {
  console.log("[Raydium] findPoolByTokenPair - Token A:", tokenA.toBase58());
  console.log("[Raydium] findPoolByTokenPair - Token B:", tokenB.toBase58());
  
  const startTime = Date.now();

  // Try 4 combinations with memcmp filters:
  // 1. tokenA at token0Mint (offset 168), tokenB at token1Mint (offset 200)
  // 2. tokenB at token0Mint (offset 168), tokenA at token1Mint (offset 200)
  // We query both in parallel for speed

  const searchConfigs = [
    {
      name: "tokenA=token0, tokenB=token1",
      filters: [
        { dataSize: 637 },
        { memcmp: { offset: POOL_STATE_LAYOUT.TOKEN_0_MINT, bytes: tokenA.toBase58() } },
        { memcmp: { offset: POOL_STATE_LAYOUT.TOKEN_1_MINT, bytes: tokenB.toBase58() } },
      ],
    },
    {
      name: "tokenB=token0, tokenA=token1", 
      filters: [
        { dataSize: 637 },
        { memcmp: { offset: POOL_STATE_LAYOUT.TOKEN_0_MINT, bytes: tokenB.toBase58() } },
        { memcmp: { offset: POOL_STATE_LAYOUT.TOKEN_1_MINT, bytes: tokenA.toBase58() } },
      ],
    },
  ];

  console.log("[Raydium] Querying with memcmp filters (2 parallel searches)...");

  // Run both searches in parallel
  const results = await Promise.all(
    searchConfigs.map(async (config) => {
      try {
        console.log("[Raydium] Searching:", config.name);
        const accounts = await connection.getProgramAccounts(RAYDIUM_CPMM_PROGRAM_ID, {
          filters: config.filters,
        });
        console.log("[Raydium]", config.name, "found", accounts.length, "pools");
        return accounts;
      } catch (error) {
        console.error("[Raydium] Search failed for", config.name, error);
        return [];
      }
    })
  );

  console.log("[Raydium] Parallel searches took", Date.now() - startTime, "ms");

  // Combine and check results
  const allAccounts = results.flat();
  console.log("[Raydium] Total pools found:", allAccounts.length);

  for (const { pubkey, account } of allAccounts) {
    try {
      const poolState = parsePoolState(pubkey, account.data as Buffer);
      
      // Double check the pool is active
      if (poolState.status === 0) {
        console.log("[Raydium] Found active pool:", pubkey.toBase58());
        console.log("[Raydium] Pool token0:", poolState.token0Mint.toBase58());
        console.log("[Raydium] Pool token1:", poolState.token1Mint.toBase58());
        console.log("[Raydium] Pool search completed in", Date.now() - startTime, "ms");
        return poolState;
      } else {
        console.log("[Raydium] Pool", pubkey.toBase58(), "is not active (status:", poolState.status, ")");
      }
    } catch (error) {
      console.error("[Raydium] Failed to parse pool:", pubkey.toBase58(), error);
      continue;
    }
  }

  console.log("[Raydium] No active pool found after", Date.now() - startTime, "ms");
  return null;
}

/**
 * Fetch vault balances for a pool
 */
export async function getVaultBalances(
  connection: Connection,
  poolState: PoolState
): Promise<VaultBalances> {
  const [vault0Info, vault1Info] = await Promise.all([
    connection.getTokenAccountBalance(poolState.token0Vault),
    connection.getTokenAccountBalance(poolState.token1Vault),
  ]);

  return {
    vault0Balance: new BN(vault0Info.value.amount),
    vault1Balance: new BN(vault1Info.value.amount),
  };
}

/**
 * Calculate swap output using constant product formula
 * output = (input * outputReserve) / (inputReserve + input)
 * 
 * Note: Raydium CPMM pools can have fee tiers from 0.25% to 4%
 * We use a conservative 1% estimate for unknown pools
 * The slippage protection will handle any remaining difference
 */
export function calculateSwapOutput(
  amountIn: BN,
  inputReserve: BN,
  outputReserve: BN,
  feeBps: number = 100 // 1% conservative fee estimate (actual may be 0.25% - 4%)
): { amountOut: BN; priceImpact: number } {
  console.log("[Raydium] calculateSwapOutput:");
  console.log("  amountIn:", amountIn.toString());
  console.log("  inputReserve:", inputReserve.toString());
  console.log("  outputReserve:", outputReserve.toString());
  console.log("  feeBps:", feeBps);

  // Apply fee to input first (Raydium applies fee before swap)
  const feeMultiplier = new BN(10000 - feeBps);
  const feeDivisor = new BN(10000);
  const amountInAfterFee = amountIn.mul(feeMultiplier).div(feeDivisor);
  
  console.log("  amountInAfterFee:", amountInAfterFee.toString());

  // Constant product formula: x * y = k
  // output = (amountInAfterFee * outputReserve) / (inputReserve + amountInAfterFee)
  const numerator = amountInAfterFee.mul(outputReserve);
  const denominator = inputReserve.add(amountInAfterFee);
  const amountOut = numerator.div(denominator);

  console.log("  amountOut:", amountOut.toString());

  // Calculate price impact
  const spotPrice = outputReserve.mul(new BN(1e9)).div(inputReserve);
  const expectedOutput = amountIn.mul(spotPrice).div(new BN(1e9)).mul(feeMultiplier).div(feeDivisor);
  
  let priceImpact = 0;
  if (!expectedOutput.isZero()) {
    const actualRatio = amountOut.mul(new BN(10000)).div(expectedOutput);
    priceImpact = Math.max(0, (10000 - actualRatio.toNumber()) / 100);
  }

  console.log("  expectedOutput:", expectedOutput.toString());
  console.log("  priceImpact:", priceImpact, "%");

  return { amountOut, priceImpact };
}

/**
 * Get swap quote for a token pair
 */
export async function getSwapQuote(
  connection: Connection,
  poolState: PoolState,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: BN,
  slippageBps: number = 100 // 1% default slippage
): Promise<SwapQuote> {
  console.log("[Raydium] getSwapQuote:");
  console.log("  inputMint:", inputMint.toBase58());
  console.log("  outputMint:", outputMint.toBase58());
  console.log("  poolState.token0Mint:", poolState.token0Mint.toBase58());
  console.log("  poolState.token1Mint:", poolState.token1Mint.toBase58());
  
  const vaultBalances = await getVaultBalances(connection, poolState);
  console.log("  vault0Balance:", vaultBalances.vault0Balance.toString());
  console.log("  vault1Balance:", vaultBalances.vault1Balance.toString());

  // Determine swap direction
  const isToken0ToToken1 = inputMint.equals(poolState.token0Mint);
  console.log("  isToken0ToToken1:", isToken0ToToken1);
  
  const inputReserve = isToken0ToToken1
    ? vaultBalances.vault0Balance
    : vaultBalances.vault1Balance;
  const outputReserve = isToken0ToToken1
    ? vaultBalances.vault1Balance
    : vaultBalances.vault0Balance;

  console.log("  inputReserve:", inputReserve.toString());
  console.log("  outputReserve:", outputReserve.toString());

  const { amountOut, priceImpact } = calculateSwapOutput(
    amountIn,
    inputReserve,
    outputReserve
  );

  // Calculate minimum amount out with slippage
  // Use more conservative slippage for low liquidity pools
  // Pool liquidity check: if reserves are very low, use higher slippage
  const isLowLiquidity = inputReserve.lt(new BN(100_000_000)); // < 0.1 SOL
  const conservativeSlippage = isLowLiquidity ? 1500 : 500; // 15% for low liquidity, 5% otherwise
  const effectiveSlippageBps = Math.max(slippageBps, conservativeSlippage);
  
  console.log("  isLowLiquidity:", isLowLiquidity);
  console.log("  userSlippageBps:", slippageBps);
  console.log("  conservativeSlippage:", conservativeSlippage);
  console.log("  effectiveSlippageBps:", effectiveSlippageBps);
  
  const slippageMultiplier = new BN(10000 - effectiveSlippageBps);
  const minimumAmountOut = amountOut.mul(slippageMultiplier).div(new BN(10000));

  console.log("  amountOut:", amountOut.toString());
  console.log("  minimumAmountOut:", minimumAmountOut.toString());

  return {
    amountIn,
    amountOut,
    minimumAmountOut,
    priceImpact,
    inputMint,
    outputMint,
  };
}

/**
 * Get the token program for a mint
 */
async function getTokenProgramForMint(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  // WSOL uses standard token program
  if (mint.equals(NATIVE_MINT)) {
    return TOKEN_PROGRAM_ID;
  }
  
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) {
    throw new Error(`Mint account not found: ${mint.toBase58()}`);
  }
  
  return mintInfo.owner;
}

/**
 * Build the swap instruction for Raydium CPMM
 * Account order matches SDK's makeSwapCpmmBaseInInstruction exactly
 */
export function buildSwapInstruction(
  poolState: PoolState,
  payer: PublicKey,
  inputTokenAccount: PublicKey,
  outputTokenAccount: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputTokenProgram: PublicKey,
  outputTokenProgram: PublicKey,
  amountIn: BN,
  minimumAmountOut: BN
): TransactionInstruction {
  // Use hardcoded authority (same as SDK)
  const authority = RAYDIUM_CPMM_AUTHORITY;

  // Determine vault order based on whether input is token0 or token1
  // This matches SDK logic: mintA == NATIVE_MINT ? vault.A : vault.B
  const isInputToken0 = inputMint.equals(poolState.token0Mint);
  
  const inputVault = isInputToken0 ? poolState.token0Vault : poolState.token1Vault;
  const outputVault = isInputToken0 ? poolState.token1Vault : poolState.token0Vault;
  
  console.log("[Raydium] buildSwapInstruction:");
  console.log("  authority:", authority.toBase58());
  console.log("  isInputToken0:", isInputToken0);
  console.log("  inputVault:", inputVault.toBase58());
  console.log("  outputVault:", outputVault.toBase58());
  console.log("  amountIn:", amountIn.toString());
  console.log("  minimumAmountOut:", minimumAmountOut.toString());

  // Build instruction data
  // [8 bytes discriminator][8 bytes amount_in][8 bytes minimum_amount_out]
  const data = Buffer.alloc(24);
  SWAP_BASE_INPUT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(amountIn.toString()), 8);
  data.writeBigUInt64LE(BigInt(minimumAmountOut.toString()), 16);

  // Build accounts array
  // Order matters! Must match the program's expected account order
  const accounts: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: poolState.ammConfig, isSigner: false, isWritable: false },
    { pubkey: poolState.address, isSigner: false, isWritable: true },
    { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
    { pubkey: inputVault, isSigner: false, isWritable: true },
    { pubkey: outputVault, isSigner: false, isWritable: true },
    { pubkey: inputTokenProgram, isSigner: false, isWritable: false },
    { pubkey: outputTokenProgram, isSigner: false, isWritable: false },
    { pubkey: inputMint, isSigner: false, isWritable: false },
    { pubkey: outputMint, isSigner: false, isWritable: false },
    { pubkey: poolState.observationKey, isSigner: false, isWritable: true },
  ];

  return new TransactionInstruction({
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    keys: accounts,
    data,
  });
}

/**
 * Create a temporary WSOL account using seed derivation
 * This is the same approach used by Raydium SDK
 */
async function createTempWsolAccount(
  payer: PublicKey,
  amountLamports: BN
): Promise<{
  wsolAccount: PublicKey;
  seed: string;
  createInstruction: TransactionInstruction;
  initInstruction: TransactionInstruction;
}> {
  // Generate random seed for unique account address
  const randomKeypair = Keypair.generate();
  const seed = randomKeypair.publicKey.toBase58().slice(0, 32);
  
  // Derive WSOL account address using seed
  const wsolAccount = await PublicKey.createWithSeed(
    payer,
    seed,
    TOKEN_PROGRAM_ID
  );
  
  // Total lamports = rent + swap amount
  const lamports = TOKEN_ACCOUNT_RENT + amountLamports.toNumber();
  
  console.log("[Raydium] Creating temp WSOL account:", wsolAccount.toBase58());
  console.log("[Raydium] Seed:", seed);
  console.log("[Raydium] Lamports (rent + amount):", lamports);
  
  // Create account with seed - this allocates space and deposits SOL in one instruction
  const createInstruction = SystemProgram.createAccountWithSeed({
    fromPubkey: payer,
    newAccountPubkey: wsolAccount,
    basePubkey: payer,
    seed,
    lamports,
    space: ACCOUNT_SIZE, // 165 bytes for token account
    programId: TOKEN_PROGRAM_ID,
  });
  
  // Initialize as WSOL token account
  const initInstruction = createInitializeAccountInstruction(
    wsolAccount,
    NATIVE_MINT,
    payer,
    TOKEN_PROGRAM_ID
  );
  
  return {
    wsolAccount,
    seed,
    createInstruction,
    initInstruction,
  };
}

/**
 * Create a complete swap transaction with all necessary instructions
 * Handles SOL wrapping/unwrapping automatically using temporary seed accounts
 * @param poolAddress - Optional: if provided, will fetch pool directly instead of searching
 */
export async function createSwapTransaction(
  connection: Connection,
  payer: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountIn: BN,
  slippageBps: number = 100,
  poolAddress?: PublicKey // 可选：直接传入池地址，跳过搜索
): Promise<{
  transaction: VersionedTransaction;
  quote: SwapQuote;
  poolState: PoolState;
}> {
  console.log("[Raydium] === createSwapTransaction START ===");
  console.log("[Raydium] Input Mint:", inputMint.toBase58());
  console.log("[Raydium] Output Mint:", outputMint.toBase58());
  console.log("[Raydium] Amount In:", amountIn.toString());
  console.log("[Raydium] Slippage BPS:", slippageBps);
  console.log("[Raydium] Pool Address (provided):", poolAddress?.toBase58() || "not provided");

  // Check if we're dealing with native SOL
  const isInputSOL = inputMint.equals(NATIVE_MINT);
  const isOutputSOL = outputMint.equals(NATIVE_MINT);
  console.log("[Raydium] Is Input SOL (WSOL):", isInputSOL);
  console.log("[Raydium] Is Output SOL (WSOL):", isOutputSOL);

  let poolState: PoolState | null = null;
  const poolStartTime = Date.now();

  // 如果提供了池地址，直接获取；否则搜索
  if (poolAddress) {
    console.log("[Raydium] Step 1: Fetching pool by address (fast path)...");
    poolState = await getPoolStateByAddress(connection, poolAddress);
  } else {
    console.log("[Raydium] Step 1: Searching for pool (slow path)...");
    poolState = await findPoolByTokenPair(connection, inputMint, outputMint);
  }
  
  console.log("[Raydium] Step 1: Pool lookup took", Date.now() - poolStartTime, "ms");
  
  if (!poolState) {
    console.error("[Raydium] No pool found!");
    throw new Error(
      `No Raydium CPMM pool found for ${inputMint.toBase58()} and ${outputMint.toBase58()}`
    );
  }
  console.log("[Raydium] Pool found:", poolState.address.toBase58());

  // Get swap quote
  console.log("[Raydium] Step 2: Getting swap quote...");
  const quoteStartTime = Date.now();
  const quote = await getSwapQuote(
    connection,
    poolState,
    inputMint,
    outputMint,
    amountIn,
    slippageBps
  );
  console.log("[Raydium] Step 2: Quote took", Date.now() - quoteStartTime, "ms");
  console.log("[Raydium] Quote:", {
    amountIn: quote.amountIn.toString(),
    amountOut: quote.amountOut.toString(),
    minimumAmountOut: quote.minimumAmountOut.toString(),
    priceImpact: quote.priceImpact,
  });

  // Determine token programs
  console.log("[Raydium] Step 3: Getting token programs...");
  const inputTokenProgram = await getTokenProgramForMint(connection, inputMint);
  const outputTokenProgram = await getTokenProgramForMint(connection, outputMint);
  console.log("[Raydium] Input Token Program:", inputTokenProgram.toBase58());
  console.log("[Raydium] Output Token Program:", outputTokenProgram.toBase58());

  // Build instructions
  const instructions: TransactionInstruction[] = [];

  // Add compute budget instructions for priority fee
  instructions.push(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 300000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 })
  );

  // Variables to track the actual token accounts used for swap
  let inputTokenAccount: PublicKey;
  let outputTokenAccount: PublicKey;
  let tempWsolInputAccount: PublicKey | null = null;
  let tempWsolOutputAccount: PublicKey | null = null;

  // ========== Handle Input Token Account ==========
  if (isInputSOL) {
    // Create temporary WSOL account for input (using seed derivation like SDK)
    console.log("[Raydium] Step 4a: Creating temporary WSOL input account...");
    const { wsolAccount, createInstruction, initInstruction } = 
      await createTempWsolAccount(payer, amountIn);
    
    tempWsolInputAccount = wsolAccount;
    inputTokenAccount = wsolAccount;
    
    // Add create and init instructions
    instructions.push(createInstruction);
    instructions.push(initInstruction);
    
    console.log("[Raydium] Temp WSOL input account:", inputTokenAccount.toBase58());
  } else {
    // Use regular ATA for non-SOL input
    inputTokenAccount = getAssociatedTokenAddressSync(
      inputMint,
      payer,
      false,
      inputTokenProgram
    );
    console.log("[Raydium] Input Token Account (ATA):", inputTokenAccount.toBase58());
  }

  // ========== Handle Output Token Account ==========
  if (isOutputSOL) {
    // Create temporary WSOL account for output (using seed derivation like SDK)
    console.log("[Raydium] Step 4b: Creating temporary WSOL output account...");
    // For output, we only need rent (no initial amount)
    const { wsolAccount, createInstruction, initInstruction } = 
      await createTempWsolAccount(payer, new BN(0));
    
    tempWsolOutputAccount = wsolAccount;
    outputTokenAccount = wsolAccount;
    
    // Add create and init instructions
    instructions.push(createInstruction);
    instructions.push(initInstruction);
    
    console.log("[Raydium] Temp WSOL output account:", outputTokenAccount.toBase58());
  } else {
    // Use regular ATA for non-SOL output
    outputTokenAccount = getAssociatedTokenAddressSync(
      outputMint,
      payer,
      false,
      outputTokenProgram
    );
    console.log("[Raydium] Output Token Account (ATA):", outputTokenAccount.toBase58());
    
    // Check if output ATA exists, create if not (using idempotent instruction)
    console.log("[Raydium] Step 5: Adding create output ATA instruction (idempotent)...");
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        outputTokenAccount,
        payer,
        outputMint,
        outputTokenProgram
      )
    );
  }

  // Build swap instruction
  console.log("[Raydium] Step 6: Building swap instruction...");
  const swapInstruction = buildSwapInstruction(
    poolState,
    payer,
    inputTokenAccount,
    outputTokenAccount,
    inputMint,
    outputMint,
    inputTokenProgram,
    outputTokenProgram,
    quote.amountIn,
    quote.minimumAmountOut
  );
  instructions.push(swapInstruction);

  // ========== Close temporary WSOL accounts ==========
  // Close output WSOL account to get native SOL back
  if (tempWsolOutputAccount) {
    console.log("[Raydium] Step 7a: Adding close output WSOL account instruction...");
    instructions.push(
      createCloseAccountInstruction(
        tempWsolOutputAccount,
        payer,  // Destination for SOL
        payer,  // Owner
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // Close input WSOL account to recover rent
  if (tempWsolInputAccount) {
    console.log("[Raydium] Step 7b: Adding close input WSOL account instruction...");
    instructions.push(
      createCloseAccountInstruction(
        tempWsolInputAccount,
        payer,  // Destination for remaining SOL (rent)
        payer,  // Owner
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  console.log("[Raydium] Total instructions:", instructions.length);

  // Get latest blockhash
  console.log("[Raydium] Step 8: Getting latest blockhash...");
  const { blockhash } = await connection.getLatestBlockhash();
  console.log("[Raydium] Blockhash:", blockhash);

  // Create versioned transaction
  console.log("[Raydium] Step 9: Creating versioned transaction...");
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const transaction = new VersionedTransaction(messageV0);
  console.log("[Raydium] === createSwapTransaction COMPLETE ===");

  return {
    transaction,
    quote,
    poolState,
  };
}

/**
 * Raydium CPMM client for easy integration
 */
export default class RaydiumCPMM {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Find a pool for trading between two tokens
   */
  async findPool(tokenA: PublicKey, tokenB: PublicKey): Promise<PoolState | null> {
    console.log("Finding pool for", tokenA.toBase58(), tokenB.toBase58());
    return findPoolByTokenPair(this.connection, tokenA, tokenB);
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: BN,
    slippageBps: number = 100
  ): Promise<SwapQuote & { poolState: PoolState }> {
    const poolState = await findPoolByTokenPair(this.connection, inputMint, outputMint);
    if (!poolState) {
      throw new Error(
        `No Raydium CPMM pool found for ${inputMint.toBase58()} and ${outputMint.toBase58()}`
      );
    }

    const quote = await getSwapQuote(
      this.connection,
      poolState,
      inputMint,
      outputMint,
      amountIn,
      slippageBps
    );

    return { ...quote, poolState };
  }

  /**
   * Create a swap transaction
   * @param poolAddress - Optional: if provided, will fetch pool directly instead of searching
   */
  async createSwapTransaction(
    payer: PublicKey,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: BN,
    slippageBps: number = 100,
    poolAddress?: PublicKey
  ): Promise<{
    transaction: VersionedTransaction;
    quote: SwapQuote;
    poolState: PoolState;
  }> {
    return createSwapTransaction(
      this.connection,
      payer,
      inputMint,
      outputMint,
      amountIn,
      slippageBps,
      poolAddress
    );
  }

  /**
   * Get pool state by address directly
   */
  async getPoolByAddress(poolAddress: PublicKey): Promise<PoolState | null> {
    return getPoolStateByAddress(this.connection, poolAddress);
  }
}
