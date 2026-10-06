import "dotenv/config"; // must stay first: loads apps/api/.env before env.js validates it

import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

app.listen(env.PORT, () => {
  logger.info(`VERA API running at http://localhost:${env.PORT}`);
});
