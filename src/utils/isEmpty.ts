const isEmpty = (
  value: string | number | object | Array<any> | null | undefined,
): boolean => {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0) ||
    (typeof value === 'number' && isNaN(value)) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
  );
};

export default isEmpty;
