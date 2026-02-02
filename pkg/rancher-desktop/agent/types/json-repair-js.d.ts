declare module 'json-repair-js' {
  export function repairJson(json: string, options?: {
    returnObjects?: boolean;
    skipJsonParse?: boolean;
    logging?: boolean;
    ensureAscii?: boolean;
  }): string | object;
  
  export function loads(text: string): unknown;
}
