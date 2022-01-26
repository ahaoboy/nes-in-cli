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

const NES = ({
  data,
  width = 0,
  height = 0,
}: {
  data?: Uint8Array;
  width: number;
  height: number;
}) => {
  const getColor = (x: number, y: number) => {
    if (!data) return "white";
    const i = (y * width + x) * 4;
    const c = `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`;
    return c;
  };

  const list: any = [];
  for (let h = 0; h < height; h++) {
    for (let w = 0; w < width; w++) {
      list.push(<Text color={getColor(w, h)}>{BLOCK_CHAR}</Text>);
    }
    list.push(<Newline />);
    break;
  }

  return (
    <>
      {Array(width)
        .fill(0)
        .map((_, x) => (
          <Text color={getColor(x, 0)}>{BLOCK_CHAR}</Text>
        ))}
    </>
  );
};
export const BLOCK_CHAR = "█";
export const BLOCK_CHAR2 = "█";
const Counter = () => {
  const [data, setData] = useState();
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    async function main() {
      const rom = new Uint8Array(Buffer.from(island_3_base64, "base64"));
      const render = async (data: Uint8Array) => {
        setData(new Uint8Array(data));
      };
      const { width, height } = await createNes({ rom, render });
      setWidth(width);
      setHeight(height);
    }
    main();
  }, []);
  const getColor = (x: number, y: number) => {
    if (!data) return "white";
    const i = (y * width + x) * 4;
    const c = `rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`;
    return c;
  };

  return (
    <>
      {Array(width)
        .fill(0)
        .map((_, x) => (
          <Text color={getColor(x, 0)}>{BLOCK_CHAR}</Text>
        ))}
    </>
  );
};

render(<Counter />);

/*
export const BLOCK_CHAR = "█";
export const BLOCK_CHAR2 = "█";
const log = process.stderr;
async function main() {
  let st = +new Date();
  const rom = new Uint8Array(Buffer.from(island_3_base64, "base64"));
  let _w = 0;
  let _h = 0;
  const render = async (data: Uint8Array) => {
    let s = "";
    let i = 0;
    const size = _w * _h;
    let w = 0;
    let h = 0;
    let c = 0;
    while (c < size) {
      s += chalk.rgb(data[i], data[i + 1], data[i + 2])(BLOCK_CHAR);
      i += 4;
      c += 1;
      w++;
      if (w % 10 === 0) {
        s += "\n";
        h++;
        w = 0;
      }
      if (h > 4) break;
    }
    log.write(s);
    readline.moveCursor(log, 0, -4);
  };
  const { width, height } = await createNes({ rom, render });
  _w = width;
  _h = height;
}
main();
*/
