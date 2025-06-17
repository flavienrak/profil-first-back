const getCredit = (type: string) => {
  if (type === 'premium') {
    return 100000;
  } else if (type === 'booster') {
    return 25000;
  }

  return 10000;
};

export { getCredit };
