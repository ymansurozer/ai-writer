import { Output, generateText, tool } from "ai";
import type { Agent, ArticleOutline, SectionContent, SectionPlan } from "../types/agent.js";
import type { ArticleInput } from "../types/article.js";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { getUrlContentTool } from "../tools/jinaReader.js";
import chalk from "chalk";
import { getResearchTool } from "../tools/research.js";

export class EditorInChiefAgent implements Agent<"EditorInChief">
{
  role: "EditorInChief";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "EditorInChief";
    this.prompt = {
      system: `You are an expert Editor-in-Chief conducting a comprehensive article review. Your analysis will be delivered as a structured report following strict quality control protocols.

REVIEW SCOPE AND DELIVERABLES:
Your output must be a JSON report containing:
1. Global feedback points
2. Validated article title
3. Specific edit proposals with priority levels

QUALITY CONTROL CHECKLIST:
Before suggesting any edits, verify:
1. Factual accuracy through research tool
2. Internal consistency of arguments
3. Alignment with user requirements
4. Logical flow between sections
5. Content redundancy across sections - eliminate unnecessary repetition
6. Proper citation and reference usage
7. SEO optimization (if applicable)
8. Markdown formatting compliance

RESEARCH PROTOCOL:
You can use the research tool to:
1. Verify all key statistics and claims
2. Cross-reference expert opinions
3. Validate current industry standards
4. Confirm technical specifications
5. Check for recent developments

EDIT PROPOSAL CRITERIA:
Each proposed edit must:
1. Target specific text segments
2. Include clear justification
3. Provide exact replacement text
4. Assign priority level (HIGH/MEDIUM/LOW)
5. Maintain original context

Today's date: ${new Date().toISOString().split("T")[0]}`,
      user: "Please review and suggest specific edits for the following article:",
    };
  }

  async run(input: {
    userInput: ArticleInput;
    writerOutput: {
      outline: ArticleOutline;
      contentStrategy: SectionPlan[];
      sections: SectionContent[];
    };
  })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n👑 Editor-in-Chief Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Article:", input.writerOutput.outline.title));
      console.log(chalk.gray("    • Sections:", input.writerOutput.sections.length));
      if (input.userInput.customInstructions)
      {
        console.log(chalk.gray("    • Custom Instructions:"));
        console.log(chalk.gray(`      - ${input.userInput.customInstructions}`));
      }
    }

    const { tool: researcherTool, usages: researcherUsages } = getResearchTool(this.verbose);

    const { experimental_output: output, usage } = await generateText({
      model: openai("o3-mini"),
      temperature: 0.7,
      maxSteps: 5,
      messages: [
        {
          role: "system",
          content: this.prompt.system,
        },
        {
          role: "user",
          content: `${this.prompt.user}

Original Subject:
"""
${input.userInput.subject}
"""

User Requirements:
"""
${input.userInput.customInstructions || "No specific requirements provided."}
"""

Article Outline:
"""
${input.writerOutput.outline.sections
              .map(section => `${"\t".repeat(section.level - 1)}${section.heading}`)
              .join("\n")}
"""

Content Strategy:
"""
${input.writerOutput.contentStrategy
              .map(
                strategy => `
${strategy.heading}:
${strategy.keyPoints.map(point => `- ${point}`).join("\n")}`
              )
              .join("\n")}
"""

Written Sections:
"""
${input.writerOutput.sections
              .map(
                section => `
# ${section.heading}

${section.content}

${section.references ? `References:
${section.references.map(ref => `- ${ref.title}: ${ref.url}`).join("\n")}` : ""}`
              )
              .join("\n\n")}
"""`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          globalFeedback: z.array(z.string()),
          finalArticleTitle: z.string(),
          proposedEdits: z.array(z.object({
            sectionHeading: z.string(),
            originalText: z.string(),
            feedback: z.string(),
            newText: z.string(),
            priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
          })),
        }),
      }),
      tools: {
        getUrlContent: getUrlContentTool(this.verbose),
        researcher: researcherTool,
      },
    });

    if (this.verbose)
    {
      console.log(chalk.green.bold("\n✓ Final Article Review Completed"));
      console.log(chalk.gray("  • Title:", output.finalArticleTitle));
      console.log(chalk.gray("  • Number of Proposed Edits:", output.proposedEdits.length));
      console.log(chalk.gray("  • Global Feedback:"));
      for (const feedback of output.globalFeedback)
      {
        console.log(chalk.gray(`    - ${feedback}`));
      }

      if (output.proposedEdits.length > 0)
      {
        console.log(chalk.yellow("\n  ↪ Proposed Edits:"));
        for (const edit of output.proposedEdits)
        {
          console.log(chalk.yellow(`\n    • [${edit.priority}] ${edit.sectionHeading}:`));
          console.log(chalk.gray("      Reason:", edit.feedback));
          console.log(chalk.gray("      Original Text:", edit.originalText));
          console.log(chalk.gray("      New Text:", edit.newText));
        }
      }
    }

    return {
      ...output,
      usage: {
        agentUsage: usage,
        researcherUsages
      },
    };
  }
}
