import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export class FileBackedMessageDeduper {
  private readonly filePath?: string;
  private readonly seen = new Set<string>();
  private loadPromise?: Promise<void>;

  constructor(filePath?: string) {
    this.filePath = filePath?.trim() || undefined;
  }

  async has(key: string): Promise<boolean> {
    if (!this.filePath) return false;
    await this.load();
    return this.seen.has(key);
  }

  async mark(key: string): Promise<void> {
    if (!this.filePath) return;
    await this.load();
    if (this.seen.has(key)) return;

    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${key}\n`, "utf8");
    this.seen.add(key);
  }

  private async load(): Promise<void> {
    const filePath = this.filePath;
    if (!filePath) return;
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const raw = await readFile(filePath, "utf8");
          for (const line of raw.split(/\r?\n/)) {
            const key = line.trim();
            if (key) this.seen.add(key);
          }
        } catch (error) {
          const maybeCode = error as NodeJS.ErrnoException;
          if (maybeCode?.code !== "ENOENT") throw error;
        }
      })();
    }

    await this.loadPromise;
  }
}