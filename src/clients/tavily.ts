import { tavily as tavilyClient } from "@tavily/core";

const tavily = tavilyClient({ apiKey: process.env.TAVILY_API_KEY });

export default tavily;
