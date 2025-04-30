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

export { maxAgeAuthToken, imageMimeTypes, formattedDate };
