import type { ProposedEdit, SectionContent } from "../types/agent.js";
import fs from "node:fs";

export function applyEditsAndGenerateMarkdown(params: {
  title: string;
  sections: SectionContent[];
  proposedEdits: ProposedEdit[];
  globalFeedback: string[];
}): string
{
  const { title, sections, proposedEdits, globalFeedback } = params;

  // Generate the article content
  let markdown = `# ${title}\n\n`;

  // Process each section
  for (const section of sections)
  {
    let sectionContent = section.content;

    // Apply any edits for this section
    for (const edit of proposedEdits)
    {
      if (edit.sectionHeading === section.heading)
      {
        sectionContent = sectionContent.replace(edit.originalText, edit.newText);
      }
    }

    markdown += `## ${section.heading}\n\n${sectionContent}\n\n`;
  }

  // Add Editorial Notes section if there's feedback
  if (globalFeedback.length > 0)
  {
    markdown += "## Editorial Notes\n\n";
    for (const feedback of globalFeedback)
    {
      markdown += `- ${feedback}\n`;
    }
    markdown += '\n';
  }

  // Add References section if any section has references
  const allReferences = sections.flatMap(s => s.references || []);
  if (allReferences.length > 0)
  {
    markdown += "## References\n\n";
    for (const ref of allReferences)
    {
      markdown += `- [${ref.title}](${ref.url})\n`;
    }
    markdown += '\n';
  }

  return markdown;
}