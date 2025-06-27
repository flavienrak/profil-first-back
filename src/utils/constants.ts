const maxAgeAuthToken = 365 * 24 * 60 * 60 * 1000;
const authTokenType = 'authToken';
const mailValidationType = 'mailValidation';
const resetPasswordTokenType = 'resetPassword';

const imageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg',
  'image/heif',
];

const maxCvThequeUserResult = 7;

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

const domains = [
  {
    id: 1,
    label: 'Audit & Contrôle de Gestion',
    description: 'Audit interne, contrôle financier, reporting',
  },
  {
    id: 2,
    label: 'Consulting & Gestion de projet',
    description: 'Management de projet, conseil stratégique, transformation',
  },
  { id: 3, label: 'Design', description: 'Graphisme, UI/UX, Motion Design' },
  {
    id: 4,
    label: 'Développement web & Mobile',
    description: 'Front-end, back-end, applications mobiles',
  },
  {
    id: 5,
    label: 'Finance & Comptabilité',
    description: 'Analyse financière, comptabilité, trésorerie',
  },
  {
    id: 6,
    label: 'Ingénieries & Technologies',
    description: 'R&D, innovation, solutions techniques',
  },
  {
    id: 7,
    label: 'IT, Logiciels & Systèmes',
    description: 'Infrastructure, cloud, cybersécurité',
  },
  {
    id: 8,
    label: 'Marketing & Communication',
    description: 'Stratégie digitale, content marketing, relations publiques',
  },
  {
    id: 9,
    label: 'Ressources Humaines & Recrutement',
    description: 'Talent acquisition, formation, développement RH',
  },
  {
    id: 10,
    label: 'Ventes & Développement Commercial',
    description: 'Business development, account management, négociation',
  },
];

export {
  maxAgeAuthToken,
  authTokenType,
  mailValidationType,
  resetPasswordTokenType,
  imageMimeTypes,
  maxCvThequeUserResult,
  formattedDate,
  cvThequesections,
  domains,
};
