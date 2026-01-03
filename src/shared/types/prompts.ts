/**
 * Prompts 提示词预设类型定义
 */

export interface PromptPreset {
  id: string;
  name: string;
  content: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export function createDefaultPromptPreset(): PromptPreset {
  const now = Date.now();
  return {
    id: 'default',
    name: '默认提示词',
    content: '',
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
}
