// Minimal type declarations for esc-pos-encoder (v3) — the package ships
// without types. Only methods we actually use are typed.
declare module "esc-pos-encoder" {
  interface EncoderOptions {
    width?: number;
    wordWrap?: boolean;
    codepageMapping?: string;
  }

  interface QRCodeOptions {
    model?: 1 | 2;
    size?: number; // 1-8
    errorlevel?: "l" | "m" | "q" | "h";
  }

  type Align = "left" | "center" | "right";

  interface ColumnSpec {
    width: number;
    align?: Align;
    marginLeft?: number;
    marginRight?: number;
    wrap?: boolean;
    verticalAlign?: "top" | "bottom";
  }

  type CellValue = string | ((enc: EscPosEncoder) => void);

  class EscPosEncoder {
    constructor(opts?: EncoderOptions);
    initialize(): this;
    codepage(name: string): this;
    align(a: Align): this;
    bold(on?: boolean): this;
    size(width: number, height: number): this;
    text(s: string): this;
    line(s: string): this;
    newline(): this;
    qrcode(data: string, opts?: QRCodeOptions): this;
    table(columns: ColumnSpec[], rows: CellValue[][]): this;
    cut(mode?: "partial" | "full"): this;
    encode(): Uint8Array;
  }

  export default EscPosEncoder;
}
