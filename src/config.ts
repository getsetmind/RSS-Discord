import { type AppConfig, appConfigSchema } from "./types";

/**
 * @description 設定ファイルを読み込みバリデーションして返す
 * @param path - 設定ファイルのパス
 * @returns バリデーション済みのアプリケーション設定
 * @throws ファイルが存在しない場合
 */
export async function loadConfig(path: string): Promise<AppConfig> {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		throw new Error(`設定ファイルが見つかりません: ${path}`);
	}

	const raw = await file.json();
	return appConfigSchema.parse(raw);
}
