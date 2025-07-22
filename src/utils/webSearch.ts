import chalk from "chalk";
import tavily from "../clients/tavily.js";
import crypto from "node:crypto";
import { AsyncCaller } from '@grapelaw/async-caller';

const asyncCaller = new AsyncCaller();
const searchCache = new Map<string, any>();

function generateCacheKey(query: string, params: TavilySearchParams): string
{
  const paramsString = JSON.stringify(params, Object.keys(params).sort());
  return crypto
    .createHash('md5')
    .update(`${query}-${paramsString}`)
    .digest('hex');
}

export async function webSearch(query: string, params: TavilySearchParams, verbose = false)
{
  if (verbose)
  {
    console.log(chalk.yellow("\n  ↳ Running Web Search"));
    console.log(chalk.gray("    • Query:", query));
    console.log(chalk.gray("    • Search Depth:", params.searchDepth));
    if (params.topic) console.log(chalk.gray("    • Topic:", params.topic));
    if (params.days) console.log(chalk.gray("    • Time Frame:", params.days, "days"));
    if (params.maxResults) console.log(chalk.gray("    • Max Results:", params.maxResults));
    if (params.includeImages) console.log(chalk.gray("    • Include Images:", params.includeImages));
    if (params.includeImageDescriptions) console.log(chalk.gray("    • Include Image Descriptions:", params.includeImageDescriptions));
    if (params.includeDomains) console.log(chalk.gray("    • Include Domains:", params.includeDomains.join(", ")));
    if (params.excludeDomains) console.log(chalk.gray("    • Exclude Domains:", params.excludeDomains.join(", ")));
  }

  try
  {
    const cacheKey = generateCacheKey(query, params);

    if (searchCache.has(cacheKey))
    {
      if (verbose)
      {
        console.log(chalk.green(`    ✓ Returned cached results for query: ${query}`));
        console.log(chalk.gray("      • Results:", searchCache.get(cacheKey).results?.length || 0));
      }
      return searchCache.get(cacheKey);
    }

    if (verbose)
    {
      console.log(chalk.yellow(`    • No cached results found for query: ${query}`));
    }

    const response = await asyncCaller.call(async () => await tavily.search(query, {
      searchDepth: params.searchDepth,
      topic: params.topic,
      days: params.days,
      maxResults: params.maxResults,
      includeImages: params.includeImages,
      includeImageDescriptions: params.includeImageDescriptions,
      includeDomains: params.includeDomains,
      excludeDomains: params.excludeDomains,
    }))

    // Store in cache
    searchCache.set(cacheKey, response);

    if (verbose)
    {
      console.log(chalk.green(`    ✓ Search completed for query: ${query}`));
      console.log(chalk.gray("      • Results:", response.results?.length || 0));
    }

    return response;
  }
  catch (error: any)
  {
    console.error(
      chalk.red("    ✗ Search failed:"),
      chalk.gray(error.message || error.statusMessage)
    );
    return "Web search tool failed to return results.";
  }
}

export interface TavilySearchParams
{
  searchDepth: "basic" | "advanced";
  topic?: "general" | "news" | "finance";
  days?: number;
  maxResults?: number;
  includeImages?: boolean;
  includeImageDescriptions?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}