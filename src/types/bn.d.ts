declare module "bn.js" {
  export default class BN {
    constructor(
      number: number | string | number[] | Uint8Array | Buffer | BN,
      base?: number | "hex" | "le" | "be",
      endian?: "le" | "be"
    );

    clone(): BN;
    toString(base?: number | "hex", length?: number): string;
    toNumber(): number;
    toJSON(): string;
    toArray(endian?: "le" | "be", length?: number): number[];
    toArrayLike<T extends typeof Buffer | typeof Uint8Array>(
      ArrayType: T,
      endian?: "le" | "be",
      length?: number
    ): InstanceType<T>;
    toBuffer(endian?: "le" | "be", length?: number): Buffer;
    bitLength(): number;
    zeroBits(): number;
    byteLength(): number;
    isNeg(): boolean;
    isEven(): boolean;
    isOdd(): boolean;
    isZero(): boolean;
    cmp(b: BN): -1 | 0 | 1;
    lt(b: BN): boolean;
    lte(b: BN): boolean;
    gt(b: BN): boolean;
    gte(b: BN): boolean;
    eq(b: BN): boolean;
    isBN(b: unknown): b is BN;

    neg(): BN;
    abs(): BN;
    add(b: BN): BN;
    sub(b: BN): BN;
    mul(b: BN): BN;
    sqr(): BN;
    pow(b: BN): BN;
    div(b: BN): BN;
    mod(b: BN): BN;
    divRound(b: BN): BN;

    or(b: BN): BN;
    and(b: BN): BN;
    xor(b: BN): BN;
    setn(bit: number, val: boolean): BN;
    shln(bits: number): BN;
    shrn(bits: number): BN;
    testn(bit: number): boolean;
    maskn(bits: number): BN;
    bincn(bit: number): BN;
    notn(w: number): BN;

    gcd(b: BN): BN;
    egcd(b: BN): { a: BN; b: BN; gcd: BN };
    invm(b: BN): BN;

    static BN: typeof BN;
    static wordSize: number;
  }
}
