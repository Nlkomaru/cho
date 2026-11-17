import handler from "@tanstack/react-start/server-entry";

import type { ApiBindings } from "./api";
import { handleImageOptimizeQueue, type ImageOptimizeMessage } from "./services/image-optimizer";

export default {
  fetch: handler.fetch,
  async queue(batch: MessageBatch<ImageOptimizeMessage>, env: ApiBindings) {
    await handleImageOptimizeQueue(batch, env);
  },
};
