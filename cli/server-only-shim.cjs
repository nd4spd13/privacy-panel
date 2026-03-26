// Stub out the `server-only` Next.js guard so the CLI can import server modules.
// This is safe — the CLI runs in Node, never in a browser.
const Module = require("module");
const _resolveFilename = Module._resolveFilename.bind(Module);
Module._resolveFilename = function (request, ...args) {
  if (request === "server-only") return request;
  return _resolveFilename(request, ...args);
};
require.cache["server-only"] = { id: "server-only", filename: "server-only", loaded: true, exports: {} };
