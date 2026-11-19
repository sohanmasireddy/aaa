import {
  pipeline,
  TextStreamer,
  InterruptableStoppingCriteria,
} from "@huggingface/transformers";

// Lightweight model (~360M params). Swap this ID later for a bigger one.
const MODEL_ID = "onnx-community/SmolLM2-360M-Instruct";

let generator = null;
const stopping = new InterruptableStoppingCriteria();
const post = (msg) => self.postMessage(msg);

async function hasWebGPU() {
  try {
    return !!(self.navigator?.gpu && (await self.navigator.gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function load() {
  if (generator) return post({ type: "ready", device: generator.__device });
  const webgpu = await hasWebGPU();
  const device = webgpu ? "webgpu" : "wasm";
  const files = {};

  generator = await pipeline("text-generation", MODEL_ID, {
    device,
    dtype: webgpu ? "q4f16" : "q4",
    progress_callback: (p) => {
      if (p.status === "progress" && p.total) {
        files[p.file] = { loaded: p.loaded, total: p.total };
        let loaded = 0, total = 0;
        for (const f of Object.values(files)) { loaded += f.loaded; total += f.total; }
        post({ type: "progress", loaded, total });
      }
    },
  });
  generator.__device = device;
  post({ type: "ready", device });
}

async function generate(messages) {
  stopping.reset();
  let tokens = 0;
  const start = performance.now();

  const streamer = new TextStreamer(generator.tokenizer, {
    skip_prompt: true,
    skip_special_tokens: true,
    callback_function: (text) => post({ type: "token", text }),
    token_callback_function: () => {
      tokens++;
    },
  });

  await generator(messages, {
    max_new_tokens: 512,
    do_sample: true,
    temperature: 0.7,
    top_p: 0.9,
    repetition_penalty: 1.1,
    streamer,
    stopping_criteria: stopping,
  });

  const secs = (performance.now() - start) / 1000;
  post({ type: "done", tps: tokens / Math.max(secs, 0.001) });
}

self.addEventListener("message", async (e) => {
  const { type, messages } = e.data;
  try {
    if (type === "load") await load();
    else if (type === "generate") await generate(messages);
    else if (type === "stop") stopping.interrupt();
  } catch (err) {
    post({ type: "error", message: String(err?.message ?? err) });
  }
});
