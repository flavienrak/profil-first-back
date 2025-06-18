const inputToken = (model: 'gpt-4' | 'gpt-3', value: string) => {
  if (model === 'gpt-3') {
    return (4 / 6.67) * value.length;
  }
  return (2 / 6.67) * value.length;
};

const outputToken = (model: 'gpt-4' | 'gpt-3', value: string) => {
  if (model === 'gpt-3') {
    return (2 / 6.67) * value.length;
  }
  return (1 / 6.67) * value.length;
};

export { inputToken, outputToken };
