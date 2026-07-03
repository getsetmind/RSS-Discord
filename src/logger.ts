import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Supported application log levels.
 */
type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Metadata attached to one log line.
 */
type LogMetadata = Record<string, unknown>;

/**
 * Numeric severity values used for filtering.
 */
const severity: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

/**
 * ANSI terminal colors used by the console logger.
 */
const colors = {
	reset: "\u001B[0m",
	dim: "\u001B[2m",
	bright: "\u001B[1m",
	cyan: "\u001B[36m",
	green: "\u001B[32m",
	yellow: "\u001B[33m",
	red: "\u001B[31m",
};

/**
 * Color by log level.
 */
const levelColors: Record<LogLevel, string> = {
	debug: colors.cyan,
	info: colors.green,
	warn: colors.yellow,
	error: colors.red,
};

/**
 * Minimal console and JSON-file logger.
 */
export class Logger {
	/**
	 * Creates a logger that writes console output and daily log files.
	 */
	public constructor(
		private readonly logDir = "./logs",
		private readonly minLevel: LogLevel = "info",
	) {}

	/**
	 * Writes an info-level log line.
	 */
	public info(message: string, metadata: LogMetadata = {}): void {
		void this.log("info", message, metadata);
	}

	/**
	 * Writes a warning-level log line.
	 */
	public warn(message: string, metadata: LogMetadata = {}): void {
		void this.log("warn", message, metadata);
	}

	/**
	 * Writes an error-level log line.
	 */
	public error(message: string, metadata: LogMetadata = {}): void {
		void this.log("error", message, metadata);
	}

	/**
	 * Writes a log line to console and file sinks.
	 */
	private async log(
		level: LogLevel,
		message: string,
		metadata: LogMetadata,
	): Promise<void> {
		if (severity[level] < severity[this.minLevel]) {
			return;
		}

		this.writeConsole(level, message, metadata);
		await this.writeFile(level, message, metadata);
	}

	/**
	 * Writes a colored console log line.
	 */
	private writeConsole(
		level: LogLevel,
		message: string,
		metadata: LogMetadata,
	): void {
		const timestamp = new Date().toISOString();
		const color = levelColors[level];
		const levelLabel = level.toUpperCase().padEnd(5, " ");
		const attrs = Object.entries(metadata)
			.map(([key, value]) => {
				if (key === "error") {
					return ` ${colors.red}Error: ${formatValue(value)}${colors.reset}`;
				}
				return ` ${key}=${formatValue(value)}`;
			})
			.join("");
		const line = `${colors.dim}[${timestamp}]${colors.reset} ${color}${levelLabel}${colors.reset} ${colors.bright}${message}${colors.reset}${attrs}`;

		if (severity[level] >= severity.warn) {
			console.error(line);
		} else {
			console.log(line);
		}
	}

	/**
	 * Appends one JSON log line to daily app and error logs.
	 */
	private async writeFile(
		level: LogLevel,
		message: string,
		metadata: LogMetadata,
	): Promise<void> {
		try {
			await mkdir(this.logDir, { recursive: true });
			const entry = {
				timestamp: new Date().toISOString(),
				level,
				message,
				...(Object.keys(metadata).length > 0 ? { metadata } : {}),
			};
			const line = `${JSON.stringify(entry)}\n`;
			const date = getJSTDateString();
			await appendFile(join(this.logDir, `app-${date}.log`), line, "utf8");
			if (level === "error") {
				await appendFile(join(this.logDir, `error-${date}.log`), line, "utf8");
			}
		} catch (error) {
			console.error(`Failed to write log: ${formatValue(error)}`);
		}
	}
}

/**
 * Shared logger instance.
 */
export const logger = new Logger();

/**
 * Returns the current date in JST as YYYY-MM-DD.
 */
function getJSTDateString(): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

/**
 * Formats metadata values for compact console output.
 */
function formatValue(value: unknown): string {
	if (value instanceof Error) {
		return value.message;
	}
	if (typeof value === "string") {
		return value;
	}
	return JSON.stringify(value);
}
