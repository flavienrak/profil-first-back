const maxAgeAuthToken = 31536000000;

const defaultSections = [
  { name: 'profile' },
  { name: 'name' },
  { name: 'firstname' },
  { name: 'contacts' },
  { name: 'title' },
  { name: 'presentation' },
  { name: 'experiences' },
  { name: 'formations', title: 'formations', editable: true, order: 1 },
  { name: 'competences', title: 'competences', editable: true, order: 2 },
  { name: 'langues', title: 'langues', editable: true, order: 3 },
  {
    name: "centres d'interet",
    title: "centres d'interet",
    editable: true,
    order: 4,
  },
];

export { maxAgeAuthToken, defaultSections };
