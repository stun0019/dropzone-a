// Bound both network and asynchronous decoder waits; a fetch abort alone does
// not settle a GLTF parser waiting on an image decoder.
export async function withModelTimeout(task, milliseconds = 15000) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => task(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Model loading timed out'));
        }, milliseconds);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function runModelQueue(entries, concurrency, load) {
  let cursor = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, entries.length)}, async () => {
    while (cursor < entries.length) {
      const entry = entries[cursor++];
      await load(entry);
      // Let input/rendering run between expensive model parses.
      await new Promise(resolve => setTimeout(resolve, 32));
    }
  }));
}
