/**
 * Workflow to XML Converter
 *
 * Converts workflow markdown files to structured XML format
 * for automated processing and validation.
 */

import { parse as parseYaml } from "https://deno.land/std@0.208.0/yaml/mod.ts";

interface WorkflowMetadata {
  workflow: {
    id: string;
    type: string;
    scope: string;
    version: string;
    xml_convertible: boolean;
  };
  dependencies: {
    breakdownlogger?: string;
    environment_vars?: string[];
  };
  outputs: string[];
}

interface WorkflowStep {
  id: string;
  type:
    | "verification"
    | "setup"
    | "investigation"
    | "diagnosis"
    | "resolution"
    | "planning"
    | "cleanup-tests"
    | "cleanup-implementation"
    | "cleanup-docs"
    | "analysis";
  title: string;
  content: string;
  commands?: string[];
  checkpoints?: string[];
}

interface ParsedWorkflow {
  metadata: WorkflowMetadata;
  title: string;
  purpose: string;
  prerequisites: string[];
  inputs: {
    target: string;
    symptoms: string;
    context: string;
  };
  steps: WorkflowStep[];
  outputs: string[];
  successCriteria: string[];
  relatedWorkflows: string[];
  troubleshooting: Array<{
    problem: string;
    symptoms: string;
    cause: string;
    solution: string;
  }>;
}

class WorkflowXMLConverter {
  /**
   * Convert workflow markdown file to XML
   */
  async convertMarkdownToXML(
    workflowPath: string,
  ): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
    try {
      const content = await Deno.readTextFile(workflowPath);
      const parsed = this.parseWorkflowMarkdown(content);

      if (!parsed.ok) {
        return { ok: false, error: parsed.error };
      }

      const xml = this.generateXML(parsed.data);
      return { ok: true, data: xml };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to convert workflow: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Parse workflow markdown content
   */
  private parseWorkflowMarkdown(
    content: string,
  ): { ok: true; data: ParsedWorkflow } | { ok: false; error: string } {
    try {
      // Extract YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        return { ok: false, error: "No YAML frontmatter found" };
      }

      const metadata = parseYaml(frontmatterMatch[1]) as WorkflowMetadata;
      const markdownContent = content.slice(frontmatterMatch[0].length);

      // Extract title
      const titleMatch = markdownContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : "Unknown Workflow";

      // Extract purpose
      const purposeMatch = markdownContent.match(
        /##\s+目的\n\n(.+?)(?=\n##|\n$)/s,
      );
      const purpose = purposeMatch ? purposeMatch[1].trim() : "";

      // Extract prerequisites
      const prerequisitesMatch = markdownContent.match(
        /##\s+前提条件\n\n([\s\S]*?)(?=\n##)/,
      );
      const prerequisites: string[] = [];
      if (prerequisitesMatch) {
        const prereqLines = prerequisitesMatch[1].match(/- \[ \] .+/g) || [];
        prerequisites.push(
          ...prereqLines.map((line) => line.replace(/^- \[ \] /, "")),
        );
      }

      // Extract inputs
      const inputsMatch = markdownContent.match(
        /##\s+入力\n\n([\s\S]*?)(?=\n##)/,
      );
      const inputs = {
        target: "",
        symptoms: "",
        context: "",
      };
      if (inputsMatch) {
        const targetMatch = inputsMatch[1].match(/\*\*対象\*\*:\s*(.+)/);
        const symptomsMatch = inputsMatch[1].match(/\*\*症状\*\*:\s*(.+)/);
        const contextMatch = inputsMatch[1].match(
          /\*\*コンテキスト\*\*:\s*(.+)/,
        );

        inputs.target = targetMatch ? targetMatch[1] : "";
        inputs.symptoms = symptomsMatch ? symptomsMatch[1] : "";
        inputs.context = contextMatch ? contextMatch[1] : "";
      }

      // Extract steps
      const steps = this.extractSteps(markdownContent);

      // Extract outputs
      const outputsMatch = markdownContent.match(
        /##\s+出力\n\n([\s\S]*?)(?=\n##)/,
      );
      const outputs: string[] = [];
      if (outputsMatch) {
        const outputLines = outputsMatch[1].match(/- \*\*.+?\*\*:.+/g) || [];
        outputs.push(
          ...outputLines.map((line) => line.replace(/^- \*\*.+?\*\*:\s*/, "")),
        );
      }

      // Extract success criteria
      const successMatch = markdownContent.match(
        /##\s+成功基準\n\n([\s\S]*?)(?=\n##)/,
      );
      const successCriteria: string[] = [];
      if (successMatch) {
        const criteriaLines = successMatch[1].match(/- \[ \] .+/g) || [];
        successCriteria.push(
          ...criteriaLines.map((line) => line.replace(/^- \[ \] /, "")),
        );
      }

      // Extract related workflows
      const relatedMatch = markdownContent.match(
        /##\s+関連ワークフロー\n\n([\s\S]*?)(?=\n##)/,
      );
      const relatedWorkflows: string[] = [];
      if (relatedMatch) {
        const relatedLines = relatedMatch[1].match(/- \[.+?\]\(.+?\)/g) || [];
        relatedWorkflows.push(
          ...relatedLines.map((line) =>
            line.replace(/^- \[(.+?)\]\(.+?\)/, "$1")
          ),
        );
      }

      // Extract troubleshooting
      const troubleshooting = this.extractTroubleshooting(markdownContent);

      return {
        ok: true,
        data: {
          metadata,
          title,
          purpose,
          prerequisites,
          inputs,
          steps,
          outputs,
          successCriteria,
          relatedWorkflows,
          troubleshooting,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to parse markdown: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Extract workflow steps from markdown content
   */
  private extractSteps(content: string): WorkflowStep[] {
    const steps: WorkflowStep[] = [];
    const stepMatches = content.matchAll(
      /###\s+ステップ\d+:\s*(.+?)\n\n\{xml:step\s+id="(.+?)"\s+type="(.+?)"\}\n\n([\s\S]*?)\n\{\/xml:step\}/g,
    );

    for (const match of stepMatches) {
      const [, title, id, type, stepContent] = match;

      // Extract commands and checkpoints from step content
      const commands: string[] = [];
      const checkpoints: string[] = [];

      const commandMatches = stepContent.matchAll(/実行コマンド:\s*`([^`]+)`/g);
      for (const cmdMatch of commandMatches) {
        commands.push(cmdMatch[1]);
      }

      const checkpointMatches = stepContent.matchAll(/確認ポイント:\s*(.+)/g);
      for (const cpMatch of checkpointMatches) {
        checkpoints.push(cpMatch[1]);
      }

      steps.push({
        id,
        type: type as WorkflowStep["type"],
        title,
        content: stepContent.trim(),
        commands,
        checkpoints,
      });
    }

    return steps;
  }

  /**
   * Extract troubleshooting information
   */
  private extractTroubleshooting(
    content: string,
  ): Array<
    { problem: string; symptoms: string; cause: string; solution: string }
  > {
    const troubleshooting: Array<
      { problem: string; symptoms: string; cause: string; solution: string }
    > = [];

    const troubleshootingMatch = content.match(
      /##\s+トラブルシューティング\n\n([\s\S]*?)(?=\n##|$)/,
    );
    if (!troubleshootingMatch) return troubleshooting;

    const problemMatches = troubleshootingMatch[1].matchAll(
      /####\s+問題\d+:\s*(.+?)\n\n([\s\S]*?)(?=####|$)/g,
    );

    for (const match of problemMatches) {
      const [, problem, problemContent] = match;

      const symptomsMatch = problemContent.match(/\*\*症状\*\*:\s*(.+)/);
      const causeMatch = problemContent.match(/\*\*原因\*\*:\s*(.+)/);
      const solutionMatch = problemContent.match(
        /\*\*解決策\*\*:\s*([\s\S]*?)(?=\n\*\*|$)/,
      );

      troubleshooting.push({
        problem,
        symptoms: symptomsMatch ? symptomsMatch[1] : "",
        cause: causeMatch ? causeMatch[1] : "",
        solution: solutionMatch ? solutionMatch[1].trim() : "",
      });
    }

    return troubleshooting;
  }

  /**
   * Generate XML from parsed workflow
   */
  private generateXML(workflow: ParsedWorkflow): string {
    const {
      metadata,
      title,
      purpose,
      prerequisites,
      inputs,
      steps,
      outputs,
      successCriteria,
      relatedWorkflows,
      troubleshooting,
    } = workflow;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<workflow id="${metadata.workflow.id}" type="${metadata.workflow.type}" scope="${metadata.workflow.scope}" version="${metadata.workflow.version}">
  <metadata>
    <dependencies>
      ${
      metadata.dependencies.breakdownlogger
        ? `<dependency name="breakdownlogger" version="${metadata.dependencies.breakdownlogger}"/>`
        : ""
    }
    </dependencies>
    <environment_vars>
      ${
      metadata.dependencies.environment_vars?.map((env) =>
        `<var name="${env}" required="true"/>`
      ).join("\n      ") || ""
    }
    </environment_vars>
  </metadata>

  <title>${this.escapeXml(title)}</title>
  <purpose>${this.escapeXml(purpose)}</purpose>

  <prerequisites>
    ${
      prerequisites.map((prereq, index) =>
        `<condition id="${index + 1}">${this.escapeXml(prereq)}</condition>`
      ).join("\n    ")
    }
  </prerequisites>

  <inputs>
    <target>${this.escapeXml(inputs.target)}</target>
    <symptoms>${this.escapeXml(inputs.symptoms)}</symptoms>
    <context>${this.escapeXml(inputs.context)}</context>
  </inputs>

  <steps>
    ${
      steps.map((step) =>
        `<step id="${step.id}" type="${step.type}">
      <title>${this.escapeXml(step.title)}</title>
      <content>${this.escapeXml(step.content)}</content>
      ${
          step.commands?.length
            ? `<commands>
        ${
              step.commands.map((cmd) =>
                `<command>${this.escapeXml(cmd)}</command>`
              ).join("\n        ")
            }
      </commands>`
            : ""
        }
      ${
          step.checkpoints?.length
            ? `<checkpoints>
        ${
              step.checkpoints.map((cp) =>
                `<checkpoint>${this.escapeXml(cp)}</checkpoint>`
              ).join("\n        ")
            }
      </checkpoints>`
            : ""
        }
    </step>`
      ).join("\n    ")
    }
  </steps>

  <outputs>
    ${
      outputs.map((output) => `<output>${this.escapeXml(output)}</output>`)
        .join("\n    ")
    }
  </outputs>

  <success_criteria>
    ${
      successCriteria.map((criterion) =>
        `<criterion>${this.escapeXml(criterion)}</criterion>`
      ).join("\n    ")
    }
  </success_criteria>

  <related_workflows>
    ${
      relatedWorkflows.map((workflow) =>
        `<workflow>${this.escapeXml(workflow)}</workflow>`
      ).join("\n    ")
    }
  </related_workflows>

  <troubleshooting>
    ${
      troubleshooting.map((item) =>
        `<issue>
      <problem>${this.escapeXml(item.problem)}</problem>
      <symptoms>${this.escapeXml(item.symptoms)}</symptoms>
      <cause>${this.escapeXml(item.cause)}</cause>
      <solution>${this.escapeXml(item.solution)}</solution>
    </issue>`
      ).join("\n    ")
    }
  </troubleshooting>
</workflow>`;

    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  /**
   * Validate XML structure
   */
  validateXMLStructure(
    xmlContent: string,
  ): { ok: true; data: boolean } | { ok: false; error: string } {
    try {
      // Basic XML validation - check for well-formed structure
      const parser = new (globalThis as any).DOMParser();
      const doc = parser.parseFromString(xmlContent, "text/xml");

      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        return {
          ok: false,
          error: `XML parsing error: ${parserError.textContent}`,
        };
      }

      // Check for required elements
      const workflow = doc.querySelector("workflow");
      if (!workflow) {
        return { ok: false, error: "Missing root workflow element" };
      }

      const requiredElements = ["title", "purpose", "steps"];
      for (const element of requiredElements) {
        if (!doc.querySelector(element)) {
          return { ok: false, error: `Missing required element: ${element}` };
        }
      }

      return { ok: true, data: true };
    } catch (error) {
      return {
        ok: false,
        error: `XML validation failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Generate XML Schema for workflow format
   */
  generateXMLSchema(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">
  <xs:element name="workflow">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="metadata" type="metadataType"/>
        <xs:element name="title" type="xs:string"/>
        <xs:element name="purpose" type="xs:string"/>
        <xs:element name="prerequisites" type="prerequisitesType"/>
        <xs:element name="inputs" type="inputsType"/>
        <xs:element name="steps" type="stepsType"/>
        <xs:element name="outputs" type="outputsType"/>
        <xs:element name="success_criteria" type="successCriteriaType"/>
        <xs:element name="related_workflows" type="relatedWorkflowsType"/>
        <xs:element name="troubleshooting" type="troubleshootingType"/>
      </xs:sequence>
      <xs:attribute name="id" type="xs:string" use="required"/>
      <xs:attribute name="type" type="xs:string" use="required"/>
      <xs:attribute name="scope" type="xs:string" use="required"/>
      <xs:attribute name="version" type="xs:string" use="required"/>
    </xs:complexType>
  </xs:element>

  <xs:complexType name="metadataType">
    <xs:sequence>
      <xs:element name="dependencies" type="dependenciesType"/>
      <xs:element name="environment_vars" type="environmentVarsType"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="dependenciesType">
    <xs:sequence>
      <xs:element name="dependency" maxOccurs="unbounded">
        <xs:complexType>
          <xs:attribute name="name" type="xs:string" use="required"/>
          <xs:attribute name="version" type="xs:string" use="required"/>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="environmentVarsType">
    <xs:sequence>
      <xs:element name="var" maxOccurs="unbounded">
        <xs:complexType>
          <xs:attribute name="name" type="xs:string" use="required"/>
          <xs:attribute name="required" type="xs:boolean"/>
          <xs:attribute name="default" type="xs:string"/>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="prerequisitesType">
    <xs:sequence>
      <xs:element name="condition" maxOccurs="unbounded">
        <xs:complexType>
          <xs:simpleContent>
            <xs:extension base="xs:string">
              <xs:attribute name="id" type="xs:string" use="required"/>
            </xs:extension>
          </xs:simpleContent>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="inputsType">
    <xs:sequence>
      <xs:element name="target" type="xs:string"/>
      <xs:element name="symptoms" type="xs:string"/>
      <xs:element name="context" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="stepsType">
    <xs:sequence>
      <xs:element name="step" maxOccurs="unbounded">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="title" type="xs:string"/>
            <xs:element name="content" type="xs:string"/>
            <xs:element name="commands" type="commandsType" minOccurs="0"/>
            <xs:element name="checkpoints" type="checkpointsType" minOccurs="0"/>
          </xs:sequence>
          <xs:attribute name="id" type="xs:string" use="required"/>
          <xs:attribute name="type" type="stepTypeEnum" use="required"/>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>

  <xs:simpleType name="stepTypeEnum">
    <xs:restriction base="xs:string">
      <xs:enumeration value="verification"/>
      <xs:enumeration value="setup"/>
      <xs:enumeration value="investigation"/>
      <xs:enumeration value="diagnosis"/>
      <xs:enumeration value="resolution"/>
      <xs:enumeration value="planning"/>
      <xs:enumeration value="cleanup-tests"/>
      <xs:enumeration value="cleanup-implementation"/>
      <xs:enumeration value="cleanup-docs"/>
      <xs:enumeration value="analysis"/>
    </xs:restriction>
  </xs:simpleType>

  <xs:complexType name="commandsType">
    <xs:sequence>
      <xs:element name="command" type="xs:string" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="checkpointsType">
    <xs:sequence>
      <xs:element name="checkpoint" type="xs:string" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="outputsType">
    <xs:sequence>
      <xs:element name="output" type="xs:string" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="successCriteriaType">
    <xs:sequence>
      <xs:element name="criterion" type="xs:string" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="relatedWorkflowsType">
    <xs:sequence>
      <xs:element name="workflow" type="xs:string" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="troubleshootingType">
    <xs:sequence>
      <xs:element name="issue" maxOccurs="unbounded">
        <xs:complexType>
          <xs:sequence>
            <xs:element name="problem" type="xs:string"/>
            <xs:element name="symptoms" type="xs:string"/>
            <xs:element name="cause" type="xs:string"/>
            <xs:element name="solution" type="xs:string"/>
          </xs:sequence>
        </xs:complexType>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`;
  }
}

// CLI interface
if (import.meta.main) {
  const converter = new WorkflowXMLConverter();

  if (Deno.args.length < 1) {
    console.error(
      "Usage: deno run --allow-read --allow-write workflow-to-xml.ts <workflow-file> [output-file]",
    );
    Deno.exit(1);
  }

  const workflowFile = Deno.args[0];
  const outputFile = Deno.args[1] ||
    workflowFile.replace(/\.workflow\.md$/, ".xml");

  console.log(`Converting ${workflowFile} to XML...`);

  const result = await converter.convertMarkdownToXML(workflowFile);

  if (!result.ok) {
    console.error(`Conversion failed: ${result.error}`);
    Deno.exit(1);
  }

  // Validate the generated XML
  const validation = converter.validateXMLStructure(result.data);
  if (!validation.ok) {
    console.error(`XML validation failed: ${validation.error}`);
    Deno.exit(1);
  }

  await Deno.writeTextFile(outputFile, result.data);
  console.log(`Successfully converted to ${outputFile}`);

  // Generate schema if requested
  if (Deno.args.includes("--schema")) {
    const schemaFile = "workflow-schema.xsd";
    const schema = converter.generateXMLSchema();
    await Deno.writeTextFile(schemaFile, schema);
    console.log(`XML Schema generated: ${schemaFile}`);
  }
}

export { WorkflowXMLConverter };
