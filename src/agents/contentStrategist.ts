import { Output, generateText, tool } from "ai";
import type { LanguageModelUsage } from "ai";
import type { Agent, ArticleOutline, SectionPlan } from "../types/agent.js";
import { z } from "zod";
import { ResearcherAgent } from "./researcher.js";
import { getUrlContent, getUrlContentTool } from "../tools/jinaReader.js";
import chalk from "chalk";
import { openai } from "@ai-sdk/openai";
import { getResearchTool } from "../tools/research.js";

export class ContentStrategistAgent implements Agent<"ContentStrategist">
{
  role: "ContentStrategist";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "ContentStrategist";
    this.prompt = {
      system: `You are an expert content strategist specialized in developing detailed content plans for article sections. Your role is to:

1. Analyze the article outline and understand the overall narrative flow
2. Break down each section into key points that need to be covered
3. Use the researcher tool to gather supporting information and validate content direction
4. Ensure comprehensive coverage of each topic
5. Maintain logical progression and knowledge building
6. Consider SEO keywords when developing points
7. Align content strategy with requested tone and style

You must use the researcher tool to:
- Validate the importance of planned points
- Identify key trends and insights to include
- Find supporting data and examples
- Ensure comprehensive topic coverage

Your content plan will be used by writers to develop the full content, so ensure each point:
- Is clear and actionable
- Builds on previous sections
- Supports the overall article narrative
- Is supported by research

You will be required to return a JSON response conforming to the schema provided to you.

Today is ${new Date().toISOString().split("T")[0]}.`,
      user: "Please develop a detailed content plan for the following article outline:",
    };
  }

  async run(input: {
    outline: ArticleOutline;
    section: ArticleOutline["sections"][number];
    customInstructions?: string;
    previousStrategies?: SectionPlan[];
  })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n📊 Content Strategist Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Article:", input.outline.title));
      console.log(chalk.gray("    • Target Section:", input.section.heading));
      console.log(chalk.gray("    • Previous Strategies:", input.previousStrategies?.length || 0));
      if (input.customInstructions)
      {
        console.log(chalk.gray("    • Custom Instructions:", input.customInstructions));
      }
    }

    const { tool: researcherTool, usages: researcherUsages } = getResearchTool(this.verbose);

    const { experimental_output: output, usage } = await generateText({
      model: openai("gpt-4o"),
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

Article Title:
"""
${input.outline.title}
"""

Article Outline:
"""
${input.outline.sections.map(section => `${"\t".repeat(section.level - 1)}${section.heading}`).join("\n")}
"""

Previous Section Strategies:
"""
${input.previousStrategies?.map(strategy =>
            `${strategy.heading}:\n${strategy.keyPoints.map(point => `- ${point}`).join('\n')}`
          ).join('\n\n') || 'No previous sections yet.'}
"""

Section You Are Planning:
"""
${input.section.heading}
"""

Specific User Instructions:
"""
${input.customInstructions || "No specific user instructions provided."}
"""`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          heading: z.string(),
          level: z.number(),
          keyPoints: z.array(z.string()),
          references: z.array(z.object({
            title: z.string(),
            url: z.string()
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
      console.log(chalk.green.bold("\n✓ Content Strategy Developed"));
      console.log(chalk.gray("  • Section:", output.heading));
      console.log(chalk.gray("  • Key Points:", output.keyPoints.length));
      console.log(chalk.gray("  • References:", output.references.length));
    }

    return {
      plan: output,
      usage: {
        agentUsage: usage,
        researcherUsages
      }
    };
  }
}

