export type Config = {
  rom: string | Uint8Array;
  render: (data: Uint8Array) => void;
};
export type CreateNes = (
  c: Config
) => Promise<{
  width: number;
  height: number;
}>;
