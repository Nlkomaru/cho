import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";

import { api } from "../api";

const forwardApiRequest = ({ request }: { request: Request }) => api.fetch(request, env);

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forwardApiRequest,
      POST: forwardApiRequest,
      PUT: forwardApiRequest,
      PATCH: forwardApiRequest,
      DELETE: forwardApiRequest,
      OPTIONS: forwardApiRequest,
      HEAD: forwardApiRequest,
    },
  },
});
