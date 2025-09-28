import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { CommandId } from "../value-objects/command-id.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

export interface IdListStatistics {
  readonly unique_ids: number;
  readonly c1_categories: string[];
  readonly c2_actions: string[];
  readonly c3_targets: string[];
}

export interface IdListResult {
  readonly version: string;
  readonly generated_at: string;
  readonly source_directory: string;
  readonly total_files: number;
  readonly id_list: string[];
  readonly statistics: IdListStatistics;
}

/**
 * Domain service for generating command ID lists from frontmatter data
 */
export class IdListGenerator {
  generate(
    frontmatterList: FrontmatterData[],
    sourceDirectory: string,
  ): Result<IdListResult, DomainError & { message: string }> {
    if (frontmatterList.length === 0) {
      return err(createError({
        kind: "EmptyInput",
      }, "No frontmatter data provided"));
    }

    const commandIds: CommandId[] = [];
    let processedFiles = 0;

    for (const frontmatterData of frontmatterList) {
      const data = frontmatterData.getData();
      const commandIdResult = CommandId.fromFrontmatter(data);

      if (commandIdResult.ok) {
        commandIds.push(commandIdResult.data);
      }
      // Continue processing even if some files fail
      processedFiles++;
    }

    if (commandIds.length === 0) {
      return err(createError({
        kind: "AggregationFailed",
        message: "No valid command IDs found in frontmatter data",
      }));
    }

    // Remove duplicates and sort
    const uniqueIds = this.removeDuplicatesAndSort(commandIds);

    // Generate statistics
    const statistics = this.generateStatistics(uniqueIds);

    const result: IdListResult = {
      version: "1.0.0",
      generated_at: new Date().toISOString(),
      source_directory: sourceDirectory,
      total_files: processedFiles,
      id_list: uniqueIds.map((id) => id.toFullId()),
      statistics,
    };

    return ok(result);
  }

  private removeDuplicatesAndSort(commandIds: CommandId[]): CommandId[] {
    // Use a Map to track unique IDs by their full ID string
    const uniqueMap = new Map<string, CommandId>();

    for (const commandId of commandIds) {
      const fullId = commandId.toFullId();
      if (!uniqueMap.has(fullId)) {
        uniqueMap.set(fullId, commandId);
      }
    }

    // Convert to array and sort by full ID
    const uniqueIds = Array.from(uniqueMap.values());
    uniqueIds.sort((a, b) => a.toFullId().localeCompare(b.toFullId()));

    return uniqueIds;
  }

  private generateStatistics(commandIds: CommandId[]): IdListStatistics {
    const c1Set = new Set<string>();
    const c2Set = new Set<string>();
    const c3Set = new Set<string>();

    for (const commandId of commandIds) {
      c1Set.add(commandId.getC1());
      c2Set.add(commandId.getC2());
      c3Set.add(commandId.getC3());
    }

    return {
      unique_ids: commandIds.length,
      c1_categories: Array.from(c1Set).sort(),
      c2_actions: Array.from(c2Set).sort(),
      c3_targets: Array.from(c3Set).sort(),
    };
  }
}
