import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseClaudeResponse } from '../utils/jsonParser.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const generatePromptTemplate = readFileSync(
  resolve(__dirname, '../prompts/generate-word.md'),
  'utf-8'
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateWordData(word, slug) {
  const prompt = generatePromptTemplate
    .replace(/\{\{word\}\}/g, word)
    .replace(/\{\{slug\}\}/g, slug);

  console.log('[claude] Calling Claude API for:', word);
  const startTime = Date.now();

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = result.content[0].text;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('[claude] Response received in ' + elapsed + 's');

  const wordData = parseClaudeResponse(rawText);
  if (!wordData) {
    throw new Error('Failed to parse Claude API response');
  }

  return wordData;
}
