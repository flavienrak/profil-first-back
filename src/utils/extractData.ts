interface PersonalInfo {
  nom?: string;
  prenom?: string;
  telephone?: string;
  email?: string;
  liens?: string[];
  adresse?: string;
  autresContacts?: string[];
  contenuRestant?: string[];
  lignes: string[];
}
async function extractCVData(texte: string): Promise<PersonalInfo> {
  // Nettoyage du texte
  const lignes = texte
    .split('\n')
    .map((ligne) => ligne.trim())
    .filter((ligne) => ligne.length > 0);

  // Initialisation des variables
  let nom = '';
  let prenom = '';
  let telephone = '';
  let email = '';
  const liens: string[] = [];
  let adresse = '';
  const autresContacts: string[] = [];
  const contenuRestant: string[] = [];

  // Expressions régulières
  const regexEmail = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
  const regexTelephone =
    /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}/;
  const regexURL = /https?:\/\/[^\s]+/g;

  for (const ligne of lignes) {
    if (!email && regexEmail.test(ligne)) {
      email = ligne.match(regexEmail)?.[0] || '';
      continue;
    }

    if (!telephone && regexTelephone.test(ligne)) {
      telephone = ligne.match(regexTelephone)?.[0] || '';
      continue;
    }

    const urls = ligne.match(regexURL);
    if (urls) {
      liens.push(...urls);
      continue;
    }

    // Supposons que le nom et le prénom sont sur la première ligne
    if (!nom && !prenom) {
      const mots = ligne.split(' ');
      if (mots.length >= 2) {
        prenom = mots[0];
        nom = mots.slice(1).join(' ');
        continue;
      }
    }

    // Si la ligne contient des mots-clés d'adresse
    if (
      !adresse &&
      /(rue|avenue|boulevard|impasse|allée|place|chemin)/i.test(ligne)
    ) {
      adresse = ligne;
      continue;
    }

    // Autres contacts possibles
    if (/téléphone|mobile|email|courriel/i.test(ligne)) {
      autresContacts.push(ligne);
      continue;
    }

    // Contenu restant
    contenuRestant.push(ligne);
  }

  return {
    nom,
    prenom,
    telephone,
    email,
    liens,
    adresse,
    autresContacts,
    lignes,
    contenuRestant,
  };
}

export { extractCVData };
