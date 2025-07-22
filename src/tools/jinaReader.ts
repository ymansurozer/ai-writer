import { AsyncCaller } from '@grapelaw/async-caller';
import { tool } from 'ai';
import chalk from 'chalk';
import { z } from 'zod';

const asyncCaller = new AsyncCaller();

export async function getUrlContent(url: string)
{
  try
  {
    const content = await asyncCaller.call(async () => await fetch(`https://r.jina.ai/${url}`));
    return content.text();
  } catch (error: any)
  {
    console.error(`Error fetching URL '${url}': ${error.message || error.statusMessage}`);
    return `Failed to read content of '${url}'.`;
  }
}

export function getUrlContentTool(verbose = false)
{
  return tool({
    description: "Get the content of a URL",
    parameters: z.object({
      url: z.string()
        .describe("The URL to get the content from"),
    }),
    execute: async ({ url }) =>
    {
      if (verbose)
      {
        console.log(chalk.yellow("\n  ↳ Fetching URL Content"));
        console.log(chalk.gray("    • URL:", url));
      }

      const content = await getUrlContent(url);

      if (verbose)
      {
        console.log(chalk.green("    ✓ Content retrieved"));
        console.log(chalk.gray("      • Title:", content.split("\n")[0]));
        console.log(chalk.gray("      • Length:", content.length, "characters"));
      }

      return content;
    },
  })
}