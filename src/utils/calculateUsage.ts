import type { AgentUsage } from "../types/agent.js";
import { AgentRole } from "../types/agent.js";
import type { LanguageModelUsage } from "ai";

interface AgentCosts
{
  selfCost: number;
  researcherCost: number;
}

interface UsageCosts
{
  [AgentRole.Outliner]: AgentCosts;
  [AgentRole.ContentStrategist]: AgentCosts;
  [AgentRole.Writer]: AgentCosts;
  [AgentRole.Editor]: AgentCosts;
  [AgentRole.EditorInChief]: AgentCosts;
  total: {
    agentCosts: number;
    researchCosts: number;
  };
}

const COST_PER_1M_TOKENS = {
  o1: {
    input: 15,
    output: 60,
  },
  'gpt-4o': {
    input: 2.5,
    output: 10,
  },
  'gpt-4o-mini': {
    input: 0.15,
    output: 0.6,
  },
};

function calculateModelCost(usage: LanguageModelUsage, model: keyof typeof COST_PER_1M_TOKENS): number
{
  const costs = COST_PER_1M_TOKENS[model];
  const inputCost = (usage.promptTokens / 1_000_000) * costs.input;
  const outputCost = (usage.completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

function calculateResearcherCost(researcherUsages: AgentUsage['researcherUsages']): number
{
  if (!researcherUsages?.length) return 0;

  return researcherUsages.reduce((total, usage) =>
  {
    if (!usage) return total;
    return total + calculateModelCost(usage, 'gpt-4o-mini');
  }, 0);
}

export function calculateUsage(usage: { [K in Exclude<AgentRole, 'RESEARCHER'>]: AgentUsage[] }): UsageCosts
{
  const costs: UsageCosts = {
    [AgentRole.Outliner]: { selfCost: 0, researcherCost: 0 },
    [AgentRole.ContentStrategist]: { selfCost: 0, researcherCost: 0 },
    [AgentRole.Writer]: { selfCost: 0, researcherCost: 0 },
    [AgentRole.Editor]: { selfCost: 0, researcherCost: 0 },
    [AgentRole.EditorInChief]: { selfCost: 0, researcherCost: 0 },
    total: {
      agentCosts: 0,
      researchCosts: 0,
    },
  };

  // Calculate costs for each agent
  for (const [role, usages] of Object.entries(usage))
  {
    for (const agentUsage of usages)
    {
      if (!agentUsage) continue;

      const model = role === AgentRole.Outliner || role === AgentRole.EditorInChief
        ? 'o1'
        : 'gpt-4o';

      // Calculate self usage cost
      if (agentUsage.agentUsage)
      {
        costs[role as keyof Omit<UsageCosts, 'total'>].selfCost += calculateModelCost(agentUsage.agentUsage, model);
      }

      // Calculate researcher usage cost
      const researcherCost = calculateResearcherCost(agentUsage.researcherUsages);
      costs[role as keyof Omit<UsageCosts, 'total'>].researcherCost += researcherCost;
    }
  }

  // Calculate totals
  costs.total.agentCosts = Object.values(costs)
    .filter(cost => 'selfCost' in cost)
    .reduce((total, cost) => total + (cost as AgentCosts).selfCost, 0);

  costs.total.researchCosts = Object.values(costs)
    .filter(cost => 'researcherCost' in cost)
    .reduce((total, cost) => total + (cost as AgentCosts).researcherCost, 0);

  return costs;
}