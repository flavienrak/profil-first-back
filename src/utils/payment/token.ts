import { encoding_for_model } from '@dqbd/tiktoken';

const gpt3Token = (type: 'input' | 'output', value: string): number => {
  const encoder = encoding_for_model('gpt-3.5-turbo');
  const tokens = encoder.encode(value);
  encoder.free();

  return tokens.length * 6.67 * (type === 'input' ? 0.25 : 0.5);
};

const gpt4Token = (type: 'input' | 'output', value: string): number => {
  const encoder = encoding_for_model('gpt-4-turbo-preview');
  const tokens = encoder.encode(value);
  encoder.free();

  return tokens.length * 6.67 * (type === 'input' ? 0.5 : 1);
};

export { gpt3Token, gpt4Token };
