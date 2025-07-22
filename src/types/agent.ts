import type { LanguageModelUsage } from "ai";
import type { ArticleInput } from "./article.js";

export enum AgentRole
{
  Outliner = "OUTLINER",
  ContentStrategist = "CONTENT_STRATEGIST",
  Writer = "WRITER",
  Editor = "EDITOR",
  EditorInChief = "EDITOR_IN_CHIEF",
  Researcher = "RESEARCHER",
}

// Generic input/output types for different sections
export interface ArticleOutline
{
  title: string;
  sections: Array<{
    heading: string;
    level: number;
    subSections?: Array<{
      heading: string;
      level: number;
    }>;
  }>;
}

export interface SectionPlan
{
  heading: string;
  keyPoints: string[];
  references?: {
    title: string;
    url: string;
  }[];
}

export interface SectionContent
{
  heading: string;
  content: string;
  references?: {
    title: string;
    url: string;
  }[];
}

export interface SectionFeedback
{
  approved: boolean;
  feedback: string[];
}

export interface ProposedEdit
{
  sectionHeading: string;
  originalText: string;
  feedback: string;
  newText: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface ResearchRequest
{
  query: string;
  purpose?: string;
  context?: string;
}

export interface ResearchResult
{
  findings: Array<{
    finding: string;
    details: string;
    sourceTitle: string;
    sourceUrl: string;
  }>;
}

export interface AgentUsage
{
  agentUsage?: LanguageModelUsage;
  researcherUsages?: LanguageModelUsage[];
}

// Agent-specific input/output types
export interface AgentIO
{
  Outliner: {
    input: {
      subject: string;
      customInstructions?: string;
    };
    output: {
      outline: ArticleOutline;
      usage: AgentUsage
    };
  };
  ContentStrategist: {
    input: {
      outline: ArticleOutline;
      section: ArticleOutline["sections"][number];
      customInstructions?: string;
      previousStrategies?: SectionPlan[];
    };
    output: {
      plan: SectionPlan;
      usage: AgentUsage
    };
  };
  Writer: {
    input: {
      plan: SectionPlan;
      customInstructions?: string;
      feedback?: {
        previousContent: SectionContent;
        editorFeedback: SectionFeedback;
      }
    }
    output: {
      content: SectionContent;
      responseToEditorFeedback?: string;
      usage: AgentUsage
    };
  };
  Editor: {
    input: {
      content: SectionContent;
      customInstructions?: string;
      feedback?: {
        previousContent: SectionContent;
        previousFeedback: SectionFeedback;
        writerResponse?: string;
      }
    };
    output: {
      feedback: SectionFeedback;
      usage: AgentUsage
    };
  };
  EditorInChief: {
    input: {
      userInput: ArticleInput,
      writerOutput: {
        outline: ArticleOutline;
        contentStrategy: SectionPlan[];
        sections: SectionContent[];
      }
    };
    output: {
      finalArticleTitle: string;
      globalFeedback: string[];
      proposedEdits: ProposedEdit[];
      usage: AgentUsage
    };
  };
  Researcher: {
    input: ResearchRequest;
    output: {
      findings: ResearchResult["findings"],
      usage: LanguageModelUsage
    };
  };
}

export interface Agent<R extends keyof AgentIO>
{
  role: R;
  prompt: {
    system: string;
    user: string;
  };
  verbose?: boolean;

  run: (input: AgentIO[R]["input"]) => Promise<AgentIO[R]["output"]>;
}
