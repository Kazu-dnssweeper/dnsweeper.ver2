declare module 'papaparse' {
  export interface ParseConfig {
    header?: boolean;
    skipEmptyLines?: boolean | 'greedy';
    [key: string]: unknown;
  }

  export interface PapaStatic {
    NODE_STREAM_INPUT: any;
    parse(input: any, config?: ParseConfig): NodeJS.ReadWriteStream;
  }

  const Papa: PapaStatic;
  export default Papa;
}
