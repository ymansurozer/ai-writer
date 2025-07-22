import { Output, generateText, tool } from "ai";
import type { LanguageModelUsage } from "ai";
import type { Agent, SectionContent, SectionPlan, SectionFeedback } from "../types/agent.js";
import { z } from "zod";
import { ResearcherAgent } from "./researcher.js";
import { getUrlContent, getUrlContentTool } from "../tools/jinaReader.js";
import chalk from "chalk";
import { openai } from "@ai-sdk/openai";
import { getResearchTool } from "../tools/research.js";

export class WriterAgent implements Agent<"Writer">
{
  role: "Writer";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "Writer";
    this.prompt = {
      system: `You are an expert content writer specialized in creating engaging, well-researched, and high-quality article content. Your role is to:

1. Transform outlined points into cohesive, flowing content
2. Maintain consistency with previously written sections
3. Incorporate research findings naturally into the content
4. Adapt writing style to match requested tone and style
5. Ensure proper transitions between ideas
6. Write with SEO best practices in mind when keywords are provided
7. Address editor feedback when provided

You must use the researcher tool to:
- Verify facts and claims
- Find supporting evidence and examples
- Get up-to-date information and statistics
- Add depth to the content with expert insights

Your content will be reviewed by editors, so ensure it is:
- Well-structured and easy to read
- Factually accurate and well-supported
- Free of fluff or unnecessary repetition
- Engaging and valuable to the reader

You will be required to return a JSON response conforming to the schema provided to you.

Today is ${new Date().toISOString().split("T")[0]}.`,
      user: "Please write content for the following section based on the provided plan:",
    };
  }

  async run(input: { plan: SectionPlan; customInstructions?: string; feedback?: { previousContent: SectionContent; editorFeedback: SectionFeedback } })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n✍️  Writer Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Section:", input.plan.heading));
      console.log(chalk.gray("    • Key Points:", input.plan.keyPoints.length));
      if (input.feedback)
      {
        console.log(chalk.gray("    • Revision Iteration:", input.feedback ? "Yes" : "No"));
        console.log(chalk.yellow("    ↪ Previous Feedback:"));
        for (const feedback of input.feedback.editorFeedback.feedback)
        {
          console.log(chalk.yellow("      •", feedback));
        }
      }
      if (input.customInstructions)
      {
        console.log(chalk.gray("    • Custom Instructions:", input.customInstructions));
      }
    }

    const { tool: researcherTool, usages: researcherUsages } = getResearchTool(this.verbose);

    const { experimental_output: output, usage } = await generateText({
      model: openai("gpt-4o"),
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

Section Plan:
"""
Heading:
${input.plan.heading}

Key Points:
${input.plan.keyPoints.map((point, i) => `${i + 1}. ${point}`).join("\n")}
"""

Specific User Instructions:
"""
${input.customInstructions || "No specific user instructions provided."}
"""

${input.feedback ? `Editor Review Notes:
"""
Current Section Heading: ${input.feedback.previousContent.heading}

Current Section Content: ${input.feedback.previousContent.content}

Editor Feedback:
${input.feedback.editorFeedback.feedback.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}
"""

You can push back on the editor feedback if you think it's not accurate or if you have a good reason to disagree.` : ""}`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          content: z.object({
            heading: z.string(),
            content: z.string(),
            references: z.array(z.object({
              title: z.string(),
              url: z.string()
            })).optional(),
          }),
          responseToEditorFeedback: z.string().optional().describe("Your response to the editor feedback"),
        }),
      }),
      tools: {
        getUrlContent: getUrlContentTool(this.verbose),
        researcher: researcherTool,
      },
    });

    if (this.verbose)
    {
      console.log(chalk.green.bold("\n✓ Content Written"));
      console.log(chalk.gray("  • Section:", output.content.heading));
      console.log(chalk.gray("  • Length:", output.content.content.length, "characters"));
      if (output.content.references?.length)
      {
        console.log(chalk.gray("  • References:", output.content.references.length));
      }
      if (output.responseToEditorFeedback)
      {
        console.log(chalk.blue("  ↪ Response to Editor:"));
        console.log(chalk.blue("    ", output.responseToEditorFeedback));
      }
    }

    return {
      ...output,
      usage: {
        agentUsage: usage,
        researcherUsages
      }
    };
  }
}
