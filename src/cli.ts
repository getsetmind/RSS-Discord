#!/usr/bin/env node
import { logger } from "./logger.js";
import { main } from "./main.js";

main().catch((error: unknown) => {
	logger.error("致命的なエラー", { error });
	process.exitCode = 1;
});
