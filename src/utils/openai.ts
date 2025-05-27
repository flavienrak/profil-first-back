import { logger, openai } from '@/socket';

export const gpt3 = async (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
) => {
  try {
    return await openai.chat.completions.create({
      messages,
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
    });
  } catch (error) {
    logger.error('OpenAI API Error:', error);
    return { error };
  }
};

export const gpt4 = async (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
) => {
  try {
    return await openai.chat.completions.create({
      messages,
      model: 'gpt-4-turbo-preview',
      temperature: 0.7,
    });
  } catch (error) {
    logger.error('OpenAI API Error:', error);
    return { error };
  }
};
