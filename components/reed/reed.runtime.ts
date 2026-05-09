import { buildCoachReply } from './reed.presenter';
import type { ComposerSource } from './reed.types';

export type ReedRuntimeReplyInput = {
  displayName: string;
  prompt: string;
  source: ComposerSource;
};

export type ReedRuntime = {
  getAssistantReply: (input: ReedRuntimeReplyInput) => Promise<string>;
};

export function createLocalMockReedRuntime(): ReedRuntime {
  return {
    async getAssistantReply({ displayName, prompt, source }) {
      // The mock runtime keeps one deterministic reply strategy for all sources.
      void source;
      return buildCoachReply(prompt, displayName);
    },
  };
}
