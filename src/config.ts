import { type AppConfig, appConfigSchema } from "./types";

export async function loadConfig(path: string): Promise<AppConfig> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`設定ファイルが見つかりません: ${path}`);
	}

	const raw = await file.json();
	return appConfigSchema.parse(raw);
}
