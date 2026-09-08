import Module from "node:module";
import path from "node:path";

const original = (
  Module as unknown as {
    _resolveFilename: (...args: unknown[]) => string;
  }
)._resolveFilename;

const hyphenateRoot = path.join(
  process.cwd(),
  "node_modules/@react-pdf/hyphenate",
);

(
  Module as unknown as {
    _resolveFilename: (...args: unknown[]) => string;
  }
)._resolveFilename = function patchedResolve(request: unknown, ...rest: unknown[]) {
  if (typeof request === "string") {
    const match = /^@react-pdf\/hyphenate\/([a-z0-9-]+)$/i.exec(request);
    if (match?.[1]) {
      request = path.join(hyphenateRoot, "lib", `${match[1]}.js`);
    }
  }
  return original.call(this, request, ...rest);
};
