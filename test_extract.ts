import { extract } from "jsr:@std/front-matter@1.0.5/yaml";

const content = `---
c1: git
c2: create  
c3: refinement-issue
description: Create a refinement issue from requirements documentation
---

# Content here
`;

const result = extract(content);
console.log("attrs type:", typeof result.attrs);
console.log("attrs:", result.attrs);
console.log("frontMatter type:", typeof result.frontMatter);
console.log("frontMatter:", result.frontMatter);
