import type { Agent } from "../types/agent.js";
import { z } from "zod";
import { generateText, Output, tool } from "ai";
import { getUrlContent } from "../tools/jinaReader.js";
import chalk from "chalk";
import { webSearch } from "../utils/webSearch.js";
import { openai } from "@ai-sdk/openai";

export class ResearcherAgent implements Agent<"Researcher">
{
  role: "Researcher";
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  constructor(params: { verbose?: boolean })
  {
    this.verbose = params.verbose;
    this.role = "Researcher";
    this.prompt = {
      system: `You are an expert research assistant supporting a multi-agent article writing system. Your role is to provide comprehensive research that helps create accurate, engaging, and well-supported content.

Your responsibilities include:
- Conducting thorough research on given topics using multiple search queries
- Finding diverse, high-quality sources including academic papers, expert opinions, recent news, and industry reports
- Providing specific statistics, studies, and concrete examples
- Fact-checking claims and verifying information accuracy
- Ensuring information is current (preferably within the last 2-3 years unless historically relevant)
- Identifying emerging trends and expert predictions in the field
- Supporting different writing stages (outline creation, content development, and final verification)

When researching:
1. Start with broad, foundational queries to understand the topic landscape
2. Follow up with specific queries to dive deeper into key aspects
3. Cross-reference information across multiple reliable sources
4. Prioritize authoritative sources (e.g., academic institutions, recognized experts, respected publications)
5. Look for both supporting and contrasting viewpoints to ensure balanced coverage

You have access to the web_search tool. Use it multiple times with varied queries to build a comprehensive understanding of the topic.

Return your findings in the required JSON format, ensuring each finding is specific, actionable, and properly sourced.

Today is ${new Date().toISOString().split("T")[0]}.`,
      user: "Please carry out research on the following and provide findings with sources:",
    };
  }

  async run(input: { query: string; purpose?: string; context?: string })
  {
    if (this.verbose)
    {
      console.log(chalk.blue.bold("\n🔍 Researcher Agent Starting"));
      console.log(chalk.gray("  → Input:"));
      console.log(chalk.gray("    • Query:", input.query));
      if (input.purpose)
      {
        console.log(chalk.gray("    • Purpose:", input.purpose));
      }
      if (input.context)
      {
        console.log(chalk.gray("    • Context:", input.context));
      }
    }

    const { experimental_output: output, usage } = await generateText({
      model: openai('gpt-4o-mini'),
      temperature: 0.4,
      maxSteps: 5,
      messages: [
        {
          role: "system",
          content: this.prompt.system,
        },
        {
          role: "user",
          content: `${this.prompt.user}

Query: ${input.query}

Purpose: ${input.purpose}

Context: ${input.context}`,
        },
      ],
      experimental_output: Output.object({
        schema: z.object({
          findings: z.array(z.object({
            finding: z.string(),
            details: z.string(),
            sourceTitle: z.string(),
            sourceUrl: z.string(),
          })),
        }),
      }),
      tools: {
        getUrlContent: tool({
          description: "Get the content of a URL",
          parameters: z.object({
            url: z.string()
              .describe("The URL to get the content from"),
          }),
          execute: async ({ url }) =>
          {
            if (this.verbose)
            {
              console.log(chalk.yellow("\n  ↳ Fetching URL Content"));
              console.log(chalk.gray("    • URL:", url));
            }

            const content = await getUrlContent(url);

            if (this.verbose)
            {
              console.log(chalk.green("    ✓ Content retrieved"));
              console.log(chalk.gray("      • Title:", content.split("\n")[0]));
              console.log(chalk.gray("      • Length:", content.length, "characters"));
            }

            return content;
          },
        }),
        web_search: tool({
          description: "Search the web for information",
          parameters: z.object({
            query: z.string()
              .describe("The query to search for"),
            searchDepth: z.enum(["basic", "advanced"])
              .describe("The depth of the search"),
            topic: z.enum(["general", "finance", "news"]).optional()
              .describe("The category of the search. This will determine which of our agents will be used for the search. Default is 'general'."),
            days: z.number().optional()
              .describe("The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the 'news' search topic."),
            maxResults: z.number().optional()
              .describe("The maximum number of results to return. Default is 5."),
            includeImages: z.boolean().optional()
              .describe("Whether to Include a list of query-related images in the response. Default is False."),
            includeImageDescriptions: z.boolean().optional()
              .describe("When includeImages is set to true, this option adds descriptive text for each image. Default is false."),
            includeDomains: z.array(z.string()).optional()
              .describe("A list of domains to specifically include in the search results. Default is undefined, which includes all domains."),
            excludeDomains: z.array(z.string()).optional()
              .describe("A list of domains to specifically exclude from the search results. Default is undefined, which doesn't exclude any domains."),
          }),
          execute: async ({ query, searchDepth, topic, days, maxResults, includeImages, includeImageDescriptions, includeDomains, excludeDomains }) =>
          {
            return await webSearch(query, {
              searchDepth,
              topic,
              days,
              maxResults,
              includeImages,
              includeImageDescriptions,
              includeDomains,
              excludeDomains,
            }, this.verbose);

          },
        }),
      },
    });

    if (this.verbose)
    {
      console.log(chalk.green.bold("\n✓ Research Completed"));
      console.log(chalk.gray("  • Findings:", output.findings.length));
      for (const finding of output.findings)
      {
        console.log(chalk.yellow("  ↪ Finding:"));
        console.log(chalk.gray("    • Summary:", finding.finding));
        console.log(chalk.gray("    • Source:", finding.sourceTitle));
      }
    }

    return {
      findings: output.findings,
      usage
    };
  }
}
