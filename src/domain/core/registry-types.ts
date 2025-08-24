export interface Command {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage?: string;
  options?: {
    input?: string[];
    adaptation?: string[];
    input_file?: boolean[];
    stdin?: boolean[];
    destination?: boolean[];
  };
}

export interface Registry {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: Command[];
  };
}

export interface RegistrySchema {
  validate(data: unknown): data is Registry;
  format(registry: Registry): string;
}
