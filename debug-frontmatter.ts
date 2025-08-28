import { FrontMatterExtractorImpl } from "./src/infrastructure/adapters/frontmatter-extractor-impl.ts";
import { Document } from "./src/domain/models/entities.ts";
import {
  DocumentContent,
  DocumentPath,
} from "./src/domain/models/value-objects.ts";

// Read actual test file
const content = await Deno.readTextFile(
  "examples/sample-prompts/git-create-refinement.md",
);
console.log("File content first 200 chars:", content.substring(0, 200));

const pathResult = DocumentPath.create("git-create-refinement.md");
const contentResult = DocumentContent.create(content);

if (pathResult.ok && contentResult.ok) {
  const doc = Document.createWithFrontMatter(
    pathResult.data,
    null,
    contentResult.data,
  );

  const extractor = new FrontMatterExtractorImpl();
  const result = extractor.extract(doc);

  if (result.ok) {
    if (result.data.kind === "Extracted") {
      const fm = result.data.frontMatter;
      console.log("FrontMatter extraction successful!");
      const json = fm.getContent().toJSON();
      console.log("Type of toJSON:", typeof json);
      console.log("Content:", JSON.stringify(json, null, 2));
    } else {
      console.log("No frontmatter found");
    }
  } else {
    console.error("Extraction failed:", result.error);
  }
}
