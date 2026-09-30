declare module "vcd-parser" {
  interface Signal {
    name: string;
    signalName: string;
    module: string;
    size: number;
    wave: [string, string][];
  }
  interface ParsedVcd {
    scale: string;
    endtime: string;
    signal: Signal[];
  }
  const parser: {
    parse(
      text: string,
      options?: { compress?: boolean; expandAmbigousBus?: boolean },
    ): Promise<ParsedVcd>;
  };
  export default parser;
}
