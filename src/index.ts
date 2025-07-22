import { writeArticle } from "./orchestration/index.js";
import fs from "node:fs";

const article = await writeArticle({
  subject: "The Evolving Landscape of US Immigration Law: What Startup Founders Need to Know in 2025",
  customInstructions: `We are writing an article for publication in Fast Company. Follow the below outline for the headings:
- Key changes to immigration policy and their implications for startups.
- Navigating the complexities of obtaining work visas as an entrepreneur. (H-1B & O-1)
- Insights into future trends in immigration law affecting business leaders.
- Understanding the visa options for founders and employees.

Don't add source links to the final article. And make it concise as the whole article should be less than 800 words.`,
}, true);

fs.writeFileSync(`tmp/${Date.now().toString()}.md`, article.finalMarkdown);
