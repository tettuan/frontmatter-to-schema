// Domain Types for Frontmatter to Schema conversion

export interface PromptFile {
  path: string;
  content: string;
  commandStructure: CommandStructure;
}

export interface FrontmatterData {
  title?: string;
  description?: string;
  usage?: string;
  [key: string]: unknown;
}

export interface CommandStructure {
  c1: string; // domain/category
  c2: string; // directive/action
  c3: string; // layer/target
  input: string; // input type
  adaptation?: string; // adaptation mode
}

export interface RegistryEntry {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage: string;
  options: {
    input: string[];
    adaptation: string[];
    input_file: boolean[];
    stdin: boolean[];
    destination: boolean[];
  };
}

export interface Registry {
  version: string;
  description: string;
  tools: {
    availableConfigs: string[];
    commands: RegistryEntry[];
  };
}

export interface AnalysisResult {
  has_frontmatter: boolean;
  frontmatter: {
    title?: string;
    description?: string;
    usage?: string;
  };
  template_variables: string[];
  command_structure: CommandStructure;
  detected_options: {
    has_input_file: boolean;
    has_stdin: boolean;
    has_destination: boolean;
    user_variables: string[];
  };
}

export interface MappedEntry {
  c1: string;
  c2: string;
  c3: string;
  description: string;
  usage: string;
  options: {
    input: string[];
    adaptation: string[];
    input_file: boolean[];
    stdin: boolean[];
    destination: boolean[];
  };
}
