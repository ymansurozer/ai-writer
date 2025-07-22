import { Output, generateText, tool } from "ai";
import type { LanguageModelUsage } from "ai";
import type { Agent } from "../types/agent.js";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";
import { ResearcherAgent } from "./researcher.js";
import { getUrlContent, getUrlContentTool } from "../tools/jinaReader.js";
import chalk from "chalk";
import { getResearchTool } from "../tools/research.js";

export class OutlinerAgent implements Agent<"Outliner">
{
  role: "Outliner";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "Outliner";
    this.prompt = {
      system: `You are an expert content outliner tasked with generating a comprehensive, well-structured article outline. Your output will be used by other agents to develop detailed content.

CONTEXT AND REQUIREMENTS:
- Today's date: ${new Date().toISOString().split("T")[0]}
- Output must conform to the provided JSON schema
- Article should follow SEO best practices when keywords are provided
- Focus on creating a logical progression of knowledge

RESEARCH REQUIREMENTS:
Before creating the outline, you MUST use the researcher tool to:
1. Validate your understanding of the subject matter
2. Identify key aspects that need coverage
3. Verify current and accurate information
4. Find any gaps in the proposed structure

OUTLINE STRUCTURE:
1. Title (H1): Clear, engaging, and SEO-optimized
2. Main Sections (H2): Core topic areas
3. Subsections (H3): Supporting details and specific points

EVALUATION CRITERIA:
Your outline will be judged on:
- Comprehensive topic coverage
- Logical flow and progression
- Clear hierarchy and organization
- Alignment with article length requirements
- Integration of research findings
- SEO optimization (when applicable)
- Adherence to requested tone/style

Remember: Focus on WHAT needs to be included rather than HOW to write it. Create a structure that other agents can easily follow to produce detailed content.`,
      user: "Please create a structured outline for the following article subject. Use the user-provided instructions (tone, length, keywords) if applicable:",
    };
  }

  async run(input: { subject: string; customInstructions?: string })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n📋 Outliner Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Subject:", input.subject));
      if (input.customInstructions)
      {
        console.log(chalk.gray("    • Custom Instructions:", input.customInstructions));
      }
    }

    const { tool: researcherTool, usages: researcherUsages } = getResearchTool(this.verbose);

    const { experimental_output: output, usage } = await generateText({
      model: openai("o3-mini"),
      temperature: 0.6,
      maxSteps: 5,
      messages: [
        {
          role: "system",
          content: this.prompt.system,
        },
        {
          role: "user",
          content: `${this.prompt.user}

Subject:
"""
${input.subject}
"""

Specific User Instructions:
"""
${input.customInstructions || "No specific user instructions provided."}
"""`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          title: z.string(),
          sections: z.array(z.object({
            heading: z.string(),
            level: z.number(),
            subSections: z.array(z.object({
              heading: z.string(),
              level: z.number(),
            })).optional(),
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
      console.log(chalk.green.bold("\n✓ Outline Generated"));
      console.log(chalk.gray("  • Title:", output.title));
      console.log(chalk.gray("  • Sections:", output.sections.length));
    }

    return {
      outline: output,
      usage: {
        agentUsage: usage,
        researcherUsages
      },
    };
  }
}
