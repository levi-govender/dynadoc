import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertWithinSizeLimit } from "./keys";

export type PutObjectInput = {
  key: string;
  body: Buffer;
  contentType: string;
  maxBytes: number;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getStorageConfig() {
  return {
    bucket: requiredEnv("S3_BUCKET"),
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    accessKeyId: requiredEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("S3_SECRET_ACCESS_KEY"),
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  };
}

const globalForS3 = globalThis as unknown as { dynadocS3?: S3Client };

export function getS3Client(): S3Client {
  if (globalForS3.dynadocS3) {
    return globalForS3.dynadocS3;
  }

  const config = getStorageConfig();
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  globalForS3.dynadocS3 = client;
  return client;
}

export async function ensureBucket(): Promise<void> {
  const client = getS3Client();
  const { bucket } = getStorageConfig();
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function putObject({
  key,
  body,
  contentType,
  maxBytes,
}: PutObjectInput): Promise<string> {
  assertWithinSizeLimit(body.byteLength, maxBytes);
  const client = getS3Client();
  const { bucket } = getStorageConfig();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function getObjectBytes(key: string): Promise<Buffer> {
  const client = getS3Client();
  const { bucket } = getStorageConfig();
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`Empty object: ${key}`);
  }
  return Buffer.from(bytes);
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getS3Client();
  const { bucket } = getStorageConfig();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}
