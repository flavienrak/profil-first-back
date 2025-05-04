const maxAgeAuthToken = 31536000000;

const imageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg',
  'image/heif',
];

const today = new Date();
const formattedDate = today.toLocaleDateString('fr-FR');

const cvThequesections = [
  { name: 'title' },
  { name: 'presentation' },
  { name: 'experiences' },
  { name: 'diplomes', order: 1 },
  { name: 'formation', order: 2 },
  { name: 'competence', order: 3 },
];

export { maxAgeAuthToken, imageMimeTypes, formattedDate, cvThequesections };
