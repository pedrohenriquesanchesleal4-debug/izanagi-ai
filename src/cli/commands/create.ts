import fs from 'fs';
import path from 'path';

export function createCommand(baseDir: string, type: string, name: string): void {
  switch (type) {
    case 'agent':
      createAgent(baseDir, name);
      break;
    case 'skill':
      createSkill(baseDir, name);
      break;
    default:
      console.log(`\n\x1b[33mUnknown type: ${type}\x1b[0m`);
      console.log('Usage: nexus create <agent|skill> <name>\n');
      break;
  }
}

function createAgent(baseDir: string, name: string): void {
  const agentsDir = path.join(process.cwd(), 'agents');

  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }

  const filePath = path.join(agentsDir, `${name}.json`);

  if (fs.existsSync(filePath)) {
    console.error(`\x1b[31mAgent "${name}" already exists at ${filePath}\x1b[0m`);
    return;
  }

  const template = {
    name,
    version: '1.0.0',
    description: `Custom agent: ${name}`,
    skills: ['architect', 'frontend', 'qa'],
    chains: {
      new_project: ['architect', 'frontend'],
      review: ['qa'],
    },
    always: ['economia-tokens'],
  };

  fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
  console.log(`\n \x1b[32m✔\x1b[0m Agent created: \x1b[1m${filePath}\x1b[0m\n`);
}

function createSkill(_baseDir: string, name: string): void {
  const skillsDir = path.join(process.cwd(), 'skills');

  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }

  const dirPath = path.join(skillsDir, name);
  const filePath = path.join(dirPath, 'SKILL.md');

  if (fs.existsSync(filePath)) {
    console.error(`\x1b[31mSkill "${name}" already exists at ${filePath}\x1b[0m`);
    return;
  }

  fs.mkdirSync(dirPath, { recursive: true });

  const template = `---
name: ${name}
version: 1.0.0
priority: medium
dependencies: []
triggers:
  - task related to ${name}
token_budget: 500
compatibility: ">=1.0.0"
---

## Identity

## Goals

## Workflow

## Rules

## Checklists
`;

  fs.writeFileSync(filePath, template);
  console.log(`\n \x1b[32m✔\x1b[0m Skill created: \x1b[1m${filePath}\x1b[0m\n`);
}
