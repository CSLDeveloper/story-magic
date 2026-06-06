// fal.ai proxy for Next.js Pages Router
// This must be a catch-all route to handle all fal proxy requests
import { createRouteHandler } from '@fal-ai/server-proxy/nextjs';

const handler = createRouteHandler({
  keyFilter: () => process.env.FAL_KEY,
});

export default handler;

export const config = {
  api: {
    bodyParser: false,
  },
};
