import { FrontMatterContent } from "./src/domain/models/value-objects.ts";

const obj = {
  c1: "git",
  c2: "create",
  c3: "refinement-issue",
};

const result = FrontMatterContent.fromObject(obj);
if (result.ok) {
  console.log("FrontMatterContent created");
  const json = result.data.toJSON();
  console.log("toJSON type:", typeof json);
  console.log("toJSON value:", json);
}
