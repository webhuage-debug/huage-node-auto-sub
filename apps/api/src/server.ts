import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { appConfig, getWebDistDir } from "./config.js";
import { logger } from "./logger.js";
import { registerRoutes } from "./routes.js";

async function main(): Promise<void> {
  const app = Fastify({ logger: false });
  await registerRoutes(app);

  const webDistDir = getWebDistDir();
  const indexHtml = path.join(webDistDir, "index.html");

  if (fs.existsSync(indexHtml)) {
    await app.register(fastifyStatic, {
      root: webDistDir,
      prefix: "/"
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith("/api/")) {
        return reply.code(404).send({ error: "Not Found" });
      }
      return reply.type("text/html").send(fs.createReadStream(indexHtml));
    });
  }

  await app.listen({
    host: appConfig.host,
    port: appConfig.port
  });

  logger.info(`${appConfig.name} ${appConfig.version} listening on ${appConfig.host}:${appConfig.port}`);
}

main().catch((error) => {
  logger.error("server start failed", error);
  process.exit(1);
});
