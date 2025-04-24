import JSON5 from 'json5';

// return total questions
const questionNumber = (value: number) => {
  let total = 0;

  if (value <= 3) {
    total = value * 15;
  } else if (value <= 6) {
    total = 3 * 15 + (value - 3) * 7;
  } else {
    total = 3 * 15 + 3 * 7 + (value - 6) * 4;
  }

  return total;
};

// return question number by index
const questionNumberByIndex = (value: number) => {
  let total = 0;

  for (let i = 0; i <= value; i++) {
    if (i < 3) {
      total += 15;
    } else if (i < 6) {
      total += 7;
    } else {
      total += 4;
    }
  }

  return total;
};

// return question range
const questionRangeByIndex = (value: number) => {
  let start = 0;
  let count = 0;

  if (value < 3) {
    count = 15;
    start = value * 15;
  } else if (value < 6) {
    count = 7;
    start = 3 * 15 + (value - 3) * 7;
  } else {
    count = 4;
    start = 3 * 15 + 3 * 7 + (value - 6) * 4;
  }

  const end = start + count - 1;

  return { start, end };
};

const escapeNewlinesInJsonStrings = (block: string): string =>
  block.replace(/"(?:[^"\\]|\\.)*"/g, (strLiteral) => {
    const inner = strLiteral.slice(1, -1);
    const escaped = inner.replace(/(\r\n|\r|\n)/g, '\\n');
    return `"${escaped}"`;
  });

const extractJson = (value: string): any | null => {
  // 1) Extraction du bloc ```json``` ou fallback sur {…}
  const md =
    value.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ||
    value.match(/{[\s\S]*}/)?.[0];
  if (!md) return null;

  // 2) Pré-traitement : échappement des retours à la ligne
  const prepped = escapeNewlinesInJsonStrings(md);

  // 3) Essai JSON.parse
  try {
    return JSON.parse(prepped);
  } catch {
    console.warn('JSON.parse a échoué – on bascule sur JSON5');
  }

  // 4) Essai JSON5.parse
  try {
    return JSON5.parse(prepped);
  } catch {
    console.warn('JSON5.parse a aussi échoué');
  }

  // 5) Dernier recours : nettoyage des contrôles puis JSON5
  const sanitized = prepped
    .replace(/[\x00-\x1F]+/g, '') // supprime tabulations, bells, etc.
    .replace(/(?<!\\)(\r\n|\r|\n)/g, '\\n'); // échappe les retours à la ligne restants

  try {
    return JSON5.parse(sanitized);
  } catch (err) {
    console.error('Même après sanitation, échec JSON5.parse:', err);
    return null;
  }
};

export {
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
  extractJson,
};
