#!/usr/bin/env bun
import { migrateLegacyConfig } from "../src/config-migration.js";

/**
 * Migrates config.json to numbered .env variables.
 */
function main(): void {
	const inputPath = process.argv[2] ?? "config.json";
	const outputPath = process.argv[3] ?? ".env";
	const result = migrateLegacyConfig(inputPath, outputPath);
	console.log(
		`Migrated ${result.feedCount} feed(s): ${inputPath} -> ${outputPath}`,
	);
}

main();
