export class FrontMatter {
  constructor(
    public readonly raw: string,
    public readonly data: Record<string, unknown>,
  ) {}

  get(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  toJson(): string {
    return JSON.stringify(this.data, null, 2);
  }
}
