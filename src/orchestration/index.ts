import { ContentStrategistAgent } from "../agents/contentStrategist.js";
import { EditorAgent } from "../agents/editor.js";
import { EditorInChiefAgent } from "../agents/editorInChief.js";
import { OutlinerAgent } from "../agents/outliner.js";
import { WriterAgent } from "../agents/writer.js";
import type { AgentRole, AgentUsage, SectionContent, SectionFeedback, SectionPlan } from "../types/agent.js";
import type { ArticleInput } from "../types/article.js";
import chalk from 'chalk';
import { applyEditsAndGenerateMarkdown } from "../utils/applyEdits.js";
import fs from "node:fs";
import { calculateUsage } from "../utils/calculateUsage.js";

export async function writeArticle(input: ArticleInput, verbose = false): Promise<{
  finalMarkdown: string;
  cost: number
}>
{
  const start = new Date();
  console.log(chalk.blue.bold("\n📝 Starting Article Generation Process\n"));

  const usages: { [K in Exclude<AgentRole, 'RESEARCHER'>]: AgentUsage[] } = {
    OUTLINER: [],
    CONTENT_STRATEGIST: [],
    WRITER: [],
    EDITOR: [],
    EDITOR_IN_CHIEF: [],
  }

  try
  {
    // Create the article outline
    console.log(chalk.cyan.bold("🎯 Phase 1: Creating Article Outline"));
    console.log(chalk.gray("  → Generating outline structure..."));

    const outliner = new OutlinerAgent({ verbose });
    const { outline: articleOutline, usage: outlineUsage } = await outliner.run({
      subject: input.subject,
      customInstructions: input.customInstructions,
    });
    usages.OUTLINER.push(outlineUsage);
    fs.writeFileSync("tmp/tmp_outline.json", JSON.stringify(articleOutline, null, 2));

    console.log(chalk.green("  ✓ Outline created successfully\n"));

    // Create the content strategy for each section
    console.log(chalk.cyan.bold("🔍 Phase 2: Developing Content Strategy"));

    const contentStrategy: SectionPlan[] = []
    for (const section of articleOutline.sections)
    {
      console.log(chalk.yellow(`  ↳ Planning strategy for section: "${section.heading}"`));
      console.log(chalk.gray("    → Analyzing section requirements..."));

      const contentStrategist = new ContentStrategistAgent({ verbose });
      const { plan: result, usage } = await contentStrategist.run({
        outline: articleOutline,
        section,
        customInstructions: input.customInstructions,
        previousStrategies: contentStrategy,
      });
      usages.CONTENT_STRATEGIST.push(usage)
      contentStrategy.push(result);

      fs.writeFileSync("tmp/tmp_contentStrategy.json", JSON.stringify(contentStrategy, null, 2));

      console.log(chalk.gray("      • Key points planned:", result.keyPoints.length));
      if (result.references?.length)
      {
        console.log(chalk.gray("      • References identified:", result.references.length));
      }
    }
    console.log(chalk.green("  ✓ Content strategy completed\n"));

    // Write the content for each section
    console.log(chalk.cyan.bold("✍️  Phase 3: Writing and Editing Content"));

    const writer = new WriterAgent({ verbose });
    const editor = new EditorAgent({ verbose });

    console.log(chalk.gray("    → Processing all sections concurrently..."));
    const sectionContents = await Promise.all(contentStrategy.map(async (sectionPlan) =>
    {
      console.log(chalk.yellow(`\n  ↳ Working on section: "${sectionPlan.heading}"`));
      let isApproved = false;
      let iterations = 0;
      const MAX_ITERATIONS = 3;

      let currentContent: SectionContent | undefined;
      let currentFeedback: {
        previousContent: SectionContent;
        editorFeedback: SectionFeedback;
      } | undefined;

      while (!isApproved && iterations < MAX_ITERATIONS)
      {
        iterations++;
        console.log(chalk.magenta(`    Iteration ${iterations}/${MAX_ITERATIONS}:`));

        // Writer generates or revises content
        console.log(chalk.gray("      → Writer generating content..."));
        const writerResult = await writer.run({
          plan: sectionPlan,
          customInstructions: input.customInstructions,
          feedback: currentFeedback
        });

        usages.WRITER.push(writerResult.usage)
        currentContent = writerResult.content;

        // Editor reviews the content
        console.log(chalk.gray("      → Editor reviewing content..."));

        const { feedback: editorResult, usage } = await editor.run({
          content: currentContent,
          customInstructions: input.customInstructions,
          feedback: currentFeedback ? {
            previousContent: currentFeedback.previousContent,
            previousFeedback: currentFeedback.editorFeedback,
            writerResponse: writerResult.responseToEditorFeedback
          } : undefined
        });

        usages.EDITOR.push(usage)
        isApproved = editorResult.approved;

        if (isApproved)
        {
          console.log(chalk.green("      ✓ Content approved by editor"));
        } else if (iterations < MAX_ITERATIONS)
        {
          console.log(chalk.yellow("      ⟳ Revision requested by editor"));
          currentFeedback = {
            previousContent: currentContent,
            editorFeedback: editorResult
          };
        } else
        {
          console.log(chalk.red("      ⚠ Max iterations reached - using last version"));
        }
      }

      if (currentContent)
      {
        if (currentContent.references?.length)
        {
          console.log(chalk.gray("      📚 References used:", currentContent.references.length));
        }
        return currentContent;
      }
      throw new Error(`Failed to generate content for section: ${sectionPlan.heading}`);
    }));

    fs.writeFileSync("tmp/tmp_sectionContents.json", JSON.stringify(sectionContents, null, 2));

    // EditorInChief reviews the article
    console.log(chalk.cyan.bold("\n🔍 Phase 4: Final Review"));

    const editorInChief = new EditorInChiefAgent({ verbose });
    const { finalArticleTitle, globalFeedback, proposedEdits, usage } = await editorInChief.run({
      userInput: input,
      writerOutput: {
        outline: articleOutline,
        contentStrategy,
        sections: sectionContents
      }
    });

    fs.writeFileSync("tmp/tmp_finalReview.json", JSON.stringify({
      finalArticleTitle,
      globalFeedback,
      proposedEdits
    }, null, 2));

    usages.EDITOR_IN_CHIEF.push(usage)

    // Apply edits and generate final markdown
    console.log(chalk.cyan.bold("\n📄 Phase 5: Generating Final Article"));
    console.log(chalk.gray("  → Applying editorial changes..."));

    const finalMarkdown = applyEditsAndGenerateMarkdown({
      title: finalArticleTitle,
      sections: sectionContents,
      proposedEdits: proposedEdits,
      globalFeedback: globalFeedback
    });

    fs.writeFileSync("tmp/tmp_finalMarkdown.md", finalMarkdown);

    const costs = calculateUsage(usages);
    const end = new Date();

    console.log(chalk.green.bold("\n✨ Article Generation Complete!"));
    console.log(chalk.green(`   Generated ${sectionContents.length} sections`));
    console.log(chalk.green(`   Applied ${proposedEdits.length} editorial improvements`));
    if (globalFeedback.length > 0)
    {
      console.log(chalk.green(`   Added ${globalFeedback.length} editorial notes`));
    }
    console.log(chalk.green(`   Time taken: ${((end.getTime() - start.getTime()) / 1000 / 60).toFixed(2)}min`));
    console.log(chalk.green(`   Total cost: $${costs.total.agentCosts + costs.total.researchCosts}`));

    fs.writeFileSync("tmp/articleData.json", JSON.stringify({
      input,
      articleOutline,
      contentStrategy,
      generatedSections: sectionContents,
      finalReview: {
        finalArticleTitle,
        globalFeedback,
        proposedEdits
      },
      finalMarkdown,
      usages,
      costs,
      timeTakenMin: ((end.getTime() - start.getTime()) / 1000 / 60).toFixed(2)
    }, null, 2));
    fs.writeFileSync("tmp/tmp_usages.json", JSON.stringify(usages, null, 2));
    fs.writeFileSync("tmp/tmp_costs.json", JSON.stringify(costs, null, 2));

    return {
      finalMarkdown,
      cost: costs.total.agentCosts + costs.total.researchCosts
    };
  } catch (error)
  {
    console.error(chalk.red("An error occurred during article generation:"));
    console.error(error);
    fs.writeFileSync("tmp/tmp_usages.json", JSON.stringify(usages, null, 2));
    fs.writeFileSync("tmp/tmp_costs.json", JSON.stringify(calculateUsage(usages), null, 2));
    throw error;
  }
}
