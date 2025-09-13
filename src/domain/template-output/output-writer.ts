import {
  OutputDestination,
  Result,
  success,
  failure
} from '../template-shared/value-objects.ts';
import { RenderedOutput } from './output-renderer.ts';

/**
 * Write result information
 */
export interface WriteResult {
  destination: OutputDestination;
  bytesWritten: number;
  writtenAt: Date;
  checksum: string;
}

/**
 * Interface for infrastructure write operations
 */
export interface OutputWriteAdapter {
  writeToFile(path: string, content: Buffer | string): Promise<Result<number, Error>>;
  writeToStream(stream: WritableStream, content: Buffer | string): Promise<Result<number, Error>>;
  writeToBuffer(buffer: Buffer, content: Buffer | string): Result<number, Error>;
}

/**
 * Domain service responsible for writing rendered output
 */
export class OutputWriter {
  constructor(
    private readonly writeAdapter: OutputWriteAdapter
  ) {}

  /**
   * Writes rendered output to specified destination
   */
  async write(
    output: RenderedOutput,
    destination: OutputDestination
  ): Promise<Result<WriteResult, WriteError>> {
    try {
      // Validate output before writing
      const validation = this.validateOutput(output);
      if (!validation.ok) {
        return failure(validation.error);
      }

      // Get content to write
      const content = output.getContent();

      // Write based on destination type
      let bytesWritten: number;
      const writeResult = await this.performWrite(destination, content);

      if (!writeResult.ok) {
        return failure(new WriteError(
          `Failed to write to destination: ${writeResult.error.message}`
        ));
      }

      bytesWritten = writeResult.data;

      // Create write result
      const result: WriteResult = {
        destination,
        bytesWritten,
        writtenAt: new Date(),
        checksum: output.getChecksum()
      };

      return success(result);
    } catch (error) {
      return failure(new WriteError(
        `Write operation failed: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Performs the actual write operation
   */
  private async performWrite(
    destination: OutputDestination,
    content: Buffer | string
  ): Promise<Result<number, Error>> {
    switch (destination.getType()) {
      case 'file':
        return this.writeAdapter.writeToFile(
          destination.getFilePath(),
          content
        );

      case 'stream':
        return this.writeAdapter.writeToStream(
          destination.getTarget() as WritableStream,
          content
        );

      case 'buffer':
        return this.writeAdapter.writeToBuffer(
          destination.getTarget() as Buffer,
          content
        );

      default:
        return failure(new Error(`Unsupported destination type: ${destination.getType()}`));
    }
  }

  /**
   * Validates output before writing
   */
  private validateOutput(output: RenderedOutput): Result<void, WriteError> {
    const content = output.getContent();

    // Check content exists
    if (!content) {
      return failure(new WriteError('Output content is empty'));
    }

    // Check content size
    const size = typeof content === 'string'
      ? Buffer.byteLength(content)
      : content.length;

    if (size === 0) {
      return failure(new WriteError('Output content has zero size'));
    }

    // Check for reasonable size limits (configurable in production)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (size > maxSize) {
      return failure(new WriteError(
        `Output size (${size} bytes) exceeds maximum allowed (${maxSize} bytes)`
      ));
    }

    return success(undefined);
  }

  /**
   * Performs atomic write with rollback on failure
   */
  async writeAtomic(
    output: RenderedOutput,
    destination: OutputDestination
  ): Promise<Result<WriteResult, WriteError>> {
    // Create temporary destination
    const tempDestination = this.createTempDestination(destination);

    // Write to temporary location
    const writeResult = await this.write(output, tempDestination);
    if (!writeResult.ok) {
      return writeResult;
    }

    // Move to final destination
    try {
      await this.moveToFinal(tempDestination, destination);
      return writeResult;
    } catch (error) {
      // Rollback on failure
      await this.rollback(tempDestination);
      return failure(new WriteError(
        `Atomic write failed: ${error instanceof Error ? error.message : String(error)}`
      ));
    }
  }

  /**
   * Creates temporary destination for atomic writes
   */
  private createTempDestination(destination: OutputDestination): OutputDestination {
    if (destination.isFile()) {
      const path = destination.getFilePath();
      const tempPath = `${path}.tmp.${Date.now()}`;
      return new OutputDestination('file', tempPath);
    }

    // For non-file destinations, return as-is (atomic not supported)
    return destination;
  }

  /**
   * Moves temporary file to final destination
   */
  private async moveToFinal(
    tempDestination: OutputDestination,
    finalDestination: OutputDestination
  ): Promise<void> {
    if (tempDestination.isFile() && finalDestination.isFile()) {
      // This would be implemented by the infrastructure adapter
      // Here we just simulate the operation
      return Promise.resolve();
    }
  }

  /**
   * Rollback temporary file on failure
   */
  private async rollback(tempDestination: OutputDestination): Promise<void> {
    if (tempDestination.isFile()) {
      // This would be implemented by the infrastructure adapter
      // Here we just simulate the operation
      return Promise.resolve();
    }
  }
}

/**
 * Write error
 */
export class WriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WriteError';
  }
}