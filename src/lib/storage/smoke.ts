import { config } from "dotenv";
import { LOGO_MAX_BYTES, buildObjectKey } from "./keys";
import { ensureBucket, getSignedDownloadUrl, putObject } from "./s3";

config({ path: ".env.local" });
config({ path: ".env" });

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function main() {
  await ensureBucket();
  const key = buildObjectKey(
    "org_smoke",
    "doctype_smoke",
    "logos",
    "pixel.png",
  );
  const storedKey = await putObject({
    key,
    body: PNG_1X1,
    contentType: "image/png",
    maxBytes: LOGO_MAX_BYTES,
  });
  const url = await getSignedDownloadUrl(storedKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Signed download failed: ${response.status}`);
  }
  const downloaded = Buffer.from(await response.arrayBuffer());
  if (!downloaded.equals(PNG_1X1)) {
    throw new Error("Downloaded bytes do not match uploaded PNG");
  }
  console.log("storage smoke ok", { key: storedKey });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
