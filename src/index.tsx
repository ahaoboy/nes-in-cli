import init, { WasmNes } from "./nes-rust";
export * from "./nes-rust";
import { Config } from "./type";
import type { InitOutput } from "./nes-rust";
import { set, get } from "idb-keyval";
import path from "path";
import fs from "fs";
import island_3_base64 from "./rom/island_3_cn.nes";
import React, { useState, useEffect } from "react";
import { render, Text, Box, Newline } from "ink";
import { encodeRGBA } from "libwebp-wasm";
import readline from "readline";
import chalk from "chalk";
const setupAudio = (nes: WasmNes) => {
  if (!globalThis.AudioContext) return;
  const { AudioContext } = globalThis;
  if (AudioContext === undefined) {
    throw new Error("This browser seems not to support AudioContext.");
  }
  const bufferLength = 4096;
  const context = new AudioContext({ sampleRate: 44100 });
  const scriptProcessor = context.createScriptProcessor(bufferLength, 0, 1);
  scriptProcessor.onaudioprocess = (e) => {
    const data = e.outputBuffer.getChannelData(0);
    nes.update_sample_buffer(data);
    // Adjust volume
    for (let i = 0; i < data.length; i++) {
      data[i] *= 0.25;
    }
  };
  scriptProcessor.connect(context.destination);
};

const clamp = (x: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, x));
};

export const createNes: (
  c: Config
) => Promise<{
  nes: WasmNes;
  wasm: InitOutput;
  width: number;
  height: number;
}> = async ({ rom, render }) => {
  let buf: Uint8Array;
  if (typeof rom === "string") {
    buf = new Uint8Array(await (await fetch(rom)).arrayBuffer());
  } else {
    buf = rom;
  }
  const wasm = await init();
  const width = 256;
  const height = 240;
  const fps = 60;
  const pixels = new Uint8Array(width * height * 4);
  const nes = WasmNes.new();
  nes.set_rom(buf);
  setupAudio(nes);
  nes.bootup();
  const inv = 1000 / fps;
  let lastTime = 0;
  const raf = (f: () => void) => {
    // const dt = 16 - clamp(+new Date() - lastTime, 0, inv);
    setTimeout(f, 16);
    lastTime = +new Date();
  };
  const stepFrame = () => {
    raf(stepFrame);
    nes.step_frame();
    nes.update_pixels(pixels);
    render?.(pixels);
  };
  lastTime = +new Date();
  stepFrame();
  return { nes, wasm, width, height };
};
const clone = (src: ArrayBuffer) => {
  const dst = new ArrayBuffer(src.byteLength);
  new Uint8Array(dst).set(new Uint8Array(src));
  return dst;
};
export const save = async (wasm: InitOutput, id: string) => {
  const buffer = clone(wasm.memory.buffer);
  const blob = new Blob([buffer]);
  return set(id, blob);
};

const read = async (blob: Blob) => {
  const fileReader = new FileReader();
  fileReader.readAsArrayBuffer(blob);
  return new Promise<ArrayBuffer>((r) => {
    fileReader.onload = () => {
      r(fileReader.result as ArrayBuffer);
    };
  });
};

export const load = async (wasm: InitOutput, id: string) => {
  const blob = await get(id);
  if (!blob) return;
  const buffer = await read(blob);
  const mem = wasm.memory;
  new Uint8Array(mem.buffer).set(new Uint8Array(buffer));
};

export const BLOCK_CHAR = "█";
export const BLOCK_CHAR2 = "█";
const width = 256;
const height = 240;
const cx = 2;
const cy = 4;
const mw = width / cx;
const mh = height / cy;
let handle
const Counter = () => {
  const [data, setData] = useState(Array(mw * mh * 4).fill(0));
  useEffect(() => {
    async function main() {
      let st = +new Date();
      const rom = new Uint8Array(Buffer.from(island_3_base64, "base64"));
      const render = async (data: Uint8Array) => {
        const end = +new Date();
        if (end - st < 100) {
          return;
        }
        handle?.clear?.();
        st = +new Date();
        const miniData = new Uint8Array(mw * mh * 4);
        for (let j = 0; j < mh; j += 1) {
          for (let i = 0; i < mw; i += 1) {
            for (let c = 0; c < 4; c++) {
              const miniIndex = (j * mw + i) * 4 + c;
              let v = 0;
              for (let k = 0; k < cy; k++) {
                for (let p = 0; p < cx; p++) {
                  const index = ((j * cy + k) * width + p + i * cx) * 4 + c;
                  v += data[index];
                }
              }
              miniData[miniIndex] = clamp(v / (cy * cx), 0, 255) | 0;
            }
          }
        }
        // saveImg(miniData, mw, mh);
        setData(miniData);
      };
      await createNes({ rom, render });
      // const { width, height } = await createNes({ rom, render });
      // console.log(width, height);
      // setWidth(width);
      // setHeight(height);
    }
    main();
  }, []);
  const getLine = (h: number) => {
    const i = h * mw * 4;
    return Array(mw)
      .fill(0)
      .map((_, x) =>
        chalk.rgb(
          data[i + x * 4],
          data[i + x * 4 + 1],
          data[i + x * 4 + 2]
        )(BLOCK_CHAR)
      )
      .join("");
  };
  // return <Text>1</Text>;
  return (
    <>
      {Array(mh)
        .fill(0)
        .map((_, y) => (
          <Box key={y} width={width}>
            <Text>{getLine(y)}</Text>
            {/* {getLine(y)} */}
          </Box>
        ))}
    </>
  );
};

 handle = render(<Counter />);
