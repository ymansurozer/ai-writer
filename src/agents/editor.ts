import { Output, generateText, tool } from "ai";
import type { LanguageModelUsage } from "ai";
import type { Agent, SectionContent, SectionFeedback } from "../types/agent.js";
import { z } from "zod";
import { ResearcherAgent } from "./researcher.js";
import { getUrlContent, getUrlContentTool } from "../tools/jinaReader.js";
import chalk from "chalk";
import { openai } from "@ai-sdk/openai";
import { getResearchTool } from "../tools/research.js";

export class EditorAgent implements Agent<"Editor">
{
  role: "Editor";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "Editor";
    this.prompt = {
      system: `You are an expert editor specialized in reviewing and improving article content. Your role is to:

1. Review content for accuracy, clarity, and coherence
2. Ensure proper flow and transitions between ideas
3. Check for factual accuracy using the researcher tool
4. Verify proper tone and style alignment
5. Assess content completeness and depth
6. Identify areas needing improvement or expansion
7. Provide specific, actionable feedback

You can use the researcher tool to:
- Verify factual claims and statistics
- Cross-reference information accuracy
- Find additional supporting evidence when needed
- Identify potential gaps in coverage

Your feedback will be used by writers to improve the content, so ensure each point:
- Is specific and actionable
- Includes examples where helpful
- Maintains the article's intended tone and style
- Supports the overall narrative flow

You will be required to return a JSON response conforming to the schema provided to you.

Today is ${new Date().toISOString().split("T")[0]}.`,
      user: "Please review the following section content:",
    };
  }

  async run(input: {
    content: SectionContent;
    customInstructions?: string;
    feedback?: {
      previousContent: SectionContent;
      previousFeedback: SectionFeedback;
      writerResponse?: string;
    };
  })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n📝 Editor Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Section:", input.content.heading));
      console.log(chalk.gray("    • Content Length:", input.content.content.length, "characters"));
      if (input.feedback)
      {
        console.log(chalk.yellow("    ↪ Previous Review History:"));
        console.log(chalk.yellow("      • Previous Feedback Points:", input.feedback.previousFeedback.feedback.length));
        if (input.feedback.writerResponse)
        {
          console.log(chalk.blue("      • Writer's Response:"));
          console.log(chalk.blue("        ", input.feedback.writerResponse));
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
      temperature: 0.9,
      maxSteps: 5,
      messages: [
        {
          role: "system",
          content: this.prompt.system,
        },
        {
          role: "user",
          content: `${this.prompt.user}

${input.feedback ? `Previous Review:
"""
Previous Section Heading: ${input.feedback.previousContent.heading}

Previous Section Content: ${input.feedback.previousContent.content}

Previous Editor Feedback:
${input.feedback.previousFeedback.feedback.map((f: string, i: number) => `${i + 1}. ${f}`).join("\n")}
"""
` : ""}

${input.feedback ? "Revised Section:" : "Section to Review:"}

"""
Heading: ${input.content.heading}

Content: ${input.content.content}

References:
${input.content.references?.map(ref => `- ${ref.title}: ${ref.url}`).join('\n') || 'No references provided.'}

${input.feedback?.writerResponse ? `Writer Response to Previous Editor Feedback: ${input.feedback.writerResponse}` : ""}
"""

Specific User Instructions: 
"""
${input.customInstructions || "No specific user instructions provided."}
"""`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          approved: z.boolean().describe("Whether the section is approved or not"),
          feedback: z.array(z.string()).describe("The feedback for the section"),
        }),
      }),
      tools: {
        getUrlContent: getUrlContentTool(this.verbose),
        researcher: researcherTool,
      },
    });

    if (this.verbose)
    {
      console.log(chalk.green.bold("\n✓ Review Completed"));
      console.log(chalk.gray("  • Section:", input.content.heading));
      console.log(chalk.gray("  • Status:", output.approved ? "Approved ✓" : "Needs Revision ⟳"));
      if (!output.approved)
      {
        console.log(chalk.yellow("  ↪ Feedback Points:"));
        for (const feedback of output.feedback)
        {
          console.log(chalk.yellow("    •", feedback));
        }
      }
    }

    return {
      feedback: output,
      usage: {
        agentUsage: usage,
        researcherUsages
      }
    };
  }
}
