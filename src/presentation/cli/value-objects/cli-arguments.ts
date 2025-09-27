/**
 * CLI Arguments simplified for Three Domain Architecture
 */
export interface CLIArguments {
  readonly schema: string;
  readonly input: string;
  readonly output?: string;
  readonly verbose?: boolean;
}
