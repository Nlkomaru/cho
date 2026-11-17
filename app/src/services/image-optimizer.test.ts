import { afterEach, describe, expect, test, vi } from "vitest";

import { mediaImages } from "../db/schema";
import { createTestD1Harness } from "../tests/test-harness";
import {
  enqueueImageOptimization,
  handleImageOptimizeQueue,
  optimizeStoredImage,
  shouldOptimizeImageType,
  type ImageOptimizeMessage,
} from "./image-optimizer";

describe("image-optimizer", () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    while (cleanups.length > 0) cleanups.pop()?.();
  });

  test("enqueues optimization only for non-WebP/non-AVIF images", async () => {
    const send = vi.fn<Queue<ImageOptimizeMessage>["send"]>().mockResolvedValue();
    const queue = { send } as unknown as Queue<ImageOptimizeMessage>;

    expect(shouldOptimizeImageType("image/jpeg")).toBe(true);
    expect(shouldOptimizeImageType("image/png")).toBe(true);
    expect(shouldOptimizeImageType("image/webp")).toBe(false);
    expect(shouldOptimizeImageType("image/avif")).toBe(false);

    await enqueueImageOptimization(queue, { id: "img-jpeg", contentType: "image/jpeg" });
    await enqueueImageOptimization(queue, { id: "img-webp", contentType: "image/webp" });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ imageId: "img-jpeg" });
  });

  test("optimizes JPEG in R2 to smaller WebP and updates media_images metadata", async () => {
    const harness = createTestD1Harness();
    cleanups.push(harness.cleanup);

    const originalBytes = new Uint8Array(2048).fill(1);
    const optimizedBytes = new Uint8Array(512).fill(2);

    await harness.db.insert(mediaImages).values({
      id: "img-1",
      targetType: "dish",
      targetId: "dish-1",
      objectKey: "images/obj-1",
      contentType: "image/jpeg",
      byteSize: originalBytes.byteLength,
      sortOrder: 0,
    });

    const objects = new Map<string, { body: Uint8Array; contentType: string }>([
      ["images/obj-1", { body: originalBytes, contentType: "image/jpeg" }],
    ]);

    const bucket = {
      async get(key: string) {
        const entry = objects.get(key);
        if (!entry) return null;
        return {
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(entry.body);
              controller.close();
            },
          }),
        };
      },
      async put(
        key: string,
        value: Uint8Array,
        options?: { httpMetadata?: { contentType?: string } },
      ) {
        objects.set(key, {
          body: value,
          contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
        });
      },
    } as unknown as R2Bucket;

    const output = vi.fn().mockResolvedValue({
      response: () => new Response(optimizedBytes, { headers: { "Content-Type": "image/webp" } }),
    });
    const transform = vi.fn().mockReturnValue({ output });
    const images = {
      input: vi.fn().mockReturnValue({ transform }),
    } as unknown as ImagesBinding;

    const result = await optimizeStoredImage({
      db: harness.db,
      bucket,
      images,
      imageId: "img-1",
    });

    expect(result).toEqual({
      status: "optimized",
      beforeBytes: 2048,
      afterBytes: 512,
    });
    expect(transform).toHaveBeenCalledWith({ width: 1600, height: 1600, fit: "scale-down" });
    expect(output).toHaveBeenCalledWith({ format: "image/webp", quality: 82 });
    expect(objects.get("images/obj-1")).toEqual({
      body: optimizedBytes,
      contentType: "image/webp",
    });

    const row = harness.sqlite
      .prepare("SELECT content_type, byte_size FROM media_images WHERE id = 'img-1'")
      .get() as { content_type: string; byte_size: number };
    expect(row).toEqual({ content_type: "image/webp", byte_size: 512 });
  });

  test("acks missing images and retries on unexpected errors in queue handler", async () => {
    const harness = createTestD1Harness();
    cleanups.push(harness.cleanup);

    const ackOk = vi.fn();
    const retryOk = vi.fn();
    const ackErr = vi.fn();
    const retryErr = vi.fn();

    await harness.db.insert(mediaImages).values({
      id: "img-err",
      targetType: "dish",
      targetId: "dish-1",
      objectKey: "images/obj-err",
      contentType: "image/png",
      byteSize: 1000,
      sortOrder: 0,
    });

    const bucket = {
      async get(key: string) {
        if (key === "images/obj-err") throw new Error("R2 transient error");
        return null;
      },
    } as unknown as R2Bucket;
    const images = {} as ImagesBinding;

    await handleImageOptimizeQueue(
      {
        queue: "cho-image-optimize",
        messages: [
          { id: "m1", body: { imageId: "missing" }, ack: ackOk, retry: retryOk },
          { id: "m2", body: { imageId: "img-err" }, ack: ackErr, retry: retryErr },
        ],
      } as unknown as MessageBatch<ImageOptimizeMessage>,
      { DB: harness.binding, IMAGES_BUCKET: bucket, IMAGES: images },
    );

    expect(ackOk).toHaveBeenCalledTimes(1);
    expect(retryOk).not.toHaveBeenCalled();
    expect(ackErr).not.toHaveBeenCalled();
    expect(retryErr).toHaveBeenCalledTimes(1);
  });
});
