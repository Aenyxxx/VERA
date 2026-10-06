import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { routes } from "./routes.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(
  pinoHttp({
    logger,
    // Method, path, and status only: query strings can carry search terms (names).
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url.split("?")[0] }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  }),
);

app.use("/api", routes);

app.use(notFound);
app.use(errorHandler);
