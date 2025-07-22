import { type LanguageModelUsage, tool } from "ai";
import chalk from "chalk";
import { z } from "zod";
import { ResearcherAgent } from "../agents/researcher.js";

export function getResearchTool(verbose = false)
{
  const usages: LanguageModelUsage[] = [];

  const researchTool = tool({
    description: "Performs comprehensive research on a given subject and returns structured findings based on specified criteria",
    parameters: z.object({
      subject: z.string()
        .describe("The specific topic, question, or concept to investigate (e.g., 'What are the latest trends in AI?', 'Benefits of renewable energy')"),
      purpose: z.string()
        .describe("The purpose of the research (e.g., fact verification, finding examples, validating points, finding trends)"),
      context: z.string()
        .describe("Background information and constraints that guide the research scope, including target audience, depth required, and any specific focus areas"),
    }),
    execute: async ({ subject, purpose, context }) =>
    {
      if (verbose)
      {
        console.log(chalk.yellow("\n  ↳ Running Research Query"));
        console.log(chalk.gray("    • Subject:", subject));
        console.log(chalk.gray("    • Purpose:", purpose));
        console.log(chalk.gray("    • Context:", context));
      }

      const response = await new ResearcherAgent({ verbose }).run({
        query: subject,
        context,
        purpose,
      });

      if (verbose)
      {
        console.log(chalk.green("    ✓ Research completed"));
        console.log(chalk.gray("      • Findings:", response.findings.length));
      }

      usages.push(response.usage)

      return response.findings;
    },
  });

  return {
    tool: researchTool,
    usages,
  };
}
