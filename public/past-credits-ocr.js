const distribution = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist";

self.onmessage = async ({ data: image }) => {
  let worker;
  const reportError = () => self.postMessage({ type: "error" });
  try {
    importScripts(distribution + "/tesseract.min.js");
    worker = await self.Tesseract.createWorker("jpn", 1, {
      workerPath: distribution + "/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0",
      langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn@1.0.0/4.0.0_best_int",
      cachePath: "past-credits-jpn-best-int",
      logger: ({ status, progress }) => self.postMessage({ type: "progress", status, progress }),
      errorHandler: reportError,
    });
    const { data } = await worker.recognize(image);
    self.postMessage({ type: "result", text: data.text });
  } catch {
    reportError();
  } finally {
    await worker?.terminate();
  }
};
