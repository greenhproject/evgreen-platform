declare module "mammoth" {
  export function convertToHtml(input: { buffer: Buffer }): Promise<{ value: string; messages: Array<{ type: string; message: string }> }>;
}
