<script>
  import { tick } from "svelte";

  const SYSTEM = "You are a helpful, concise assistant.";

  let worker;
  let status = $state("idle"); // idle | loading | ready | generating | error
  let progress = $state(0);
  let device = $state("");
  let tps = $state(0);
  let errorMsg = $state("");
  let input = $state("");
  let messages = $state([]);
  let scroller;

  function ensureWorker() {
    if (worker) return;
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.onmessage = async ({ data }) => {
      if (data.type === "progress") {
        progress = data.total ? data.loaded / data.total : 0;
      } else if (data.type === "ready") {
        device = data.device;
        status = "ready";
      } else if (data.type === "token") {
        messages[messages.length - 1].content += data.text;
        await scrollDown();
      } else if (data.type === "done") {
        tps = data.tps;
        status = "ready";
      } else if (data.type === "error") {
        errorMsg = data.message;
        status = "error";
      }
    };
  }

  async function scrollDown() {
    await tick();
    scroller?.scrollTo({ top: scroller.scrollHeight });
  }

  function load() {
    ensureWorker();
    status = "loading";
    worker.postMessage({ type: "load" });
  }

  async function send() {
    const text = input.trim();
    if (!text || status !== "ready") return;
    input = "";
    messages.push({ role: "user", content: text });
    const history = [
      { role: "system", content: SYSTEM },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    messages.push({ role: "assistant", content: "" });
    status = "generating";
    await scrollDown();
    worker.postMessage({ type: "generate", messages: history });
  }

  function stop() {
    worker?.postMessage({ type: "stop" });
  }

  function clearChat() {
    if (status === "generating") stop();
    messages = [];
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }
</script>

<main>
  <header>
    <h1>Local Chat</h1>
    <div class="meta">
      {#if device}<span class="pill">{device}</span>{/if}
      {#if tps && status === "ready"}<span class="pill">{tps.toFixed(1)} tok/s</span>{/if}
      <button class="ghost" onclick={clearChat} disabled={!messages.length}>Clear</button>
    </div>
  </header>

  <section class="chat" bind:this={scroller}>
    {#if status === "idle" || status === "loading" || status === "error"}
      <div class="center">
        <p>Runs a small language model entirely in your browser. Nothing is sent to a server.</p>
        {#if status === "idle"}
          <button onclick={load}>Load model</button>
          <small>One-time download (a few hundred MB), then cached.</small>
        {:else if status === "loading"}
          <div class="bar"><div style="width:{Math.round(progress * 100)}%"></div></div>
          <small>Loading model… {Math.round(progress * 100)}%</small>
        {:else}
          <p class="err">{errorMsg}</p>
          <button onclick={load}>Retry</button>
        {/if}
      </div>
    {:else if !messages.length}
      <div class="center"><p>Model ready. Say something.</p></div>
    {/if}

    {#each messages as m}
      <div class="msg {m.role}">
        <div class="bubble">{m.content}{#if m.role === "assistant" && !m.content && status === "generating"}…{/if}</div>
      </div>
    {/each}
  </section>

  <footer>
    <textarea
      rows="1"
      placeholder={status === "ready" || status === "generating" ? "Message…" : "Load the model to start"}
      bind:value={input}
      onkeydown={onKey}
      disabled={status !== "ready" && status !== "generating"}
    ></textarea>
    {#if status === "generating"}
      <button onclick={stop}>Stop</button>
    {:else}
      <button onclick={send} disabled={status !== "ready" || !input.trim()}>Send</button>
    {/if}
  </footer>
</main>
