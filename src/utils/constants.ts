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

const domains = [
  {
    label: 'Audit & Contrôle de Gestion',
    description: 'Audit interne, contrôle financier, reporting',
  },
  {
    label: 'Consulting & Gestion de projet',
    description: 'Management de projet, conseil stratégique, transformation',
  },
  { label: 'Design', description: 'Graphisme, UI/UX, Motion Design' },
  {
    label: 'Développement web & Mobile',
    description: 'Front-end, back-end, applications mobiles',
  },
  {
    label: 'Finance & Comptabilité',
    description: 'Analyse financière, comptabilité, trésorerie',
  },
  {
    label: 'Ingénieries & Technologies',
    description: 'R&D, innovation, solutions techniques',
  },
  {
    label: 'IT, Logiciels & Systèmes',
    description: 'Infrastructure, cloud, cybersécurité',
  },
  {
    label: 'Marketing & Communication',
    description: 'Stratégie digitale, content marketing, relations publiques',
  },
  {
    label: 'Ressources Humaines & Recrutement',
    description: 'Talent acquisition, formation, développement RH',
  },
  {
    label: 'Ventes & Développement Commercial',
    description: 'Business development, account management, négociation',
  },
];

export {
  maxAgeAuthToken,
  imageMimeTypes,
  formattedDate,
  cvThequesections,
  domains,
};
