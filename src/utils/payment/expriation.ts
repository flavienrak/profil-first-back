const expirationDate = (type: string): Date => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  let months = 1;
  if (type === 'quali-carriere') {
    months = 6;
  }

  // Cible : mois + offset
  const targetDate = new Date(year, month + months, 1);

  // Trouver le nombre de jours dans ce mois cible
  const daysInTargetMonth = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth() + 1,
    0,
  ).getDate();

  // Si le jour demandé dépasse le nombre de jours du mois cible, on prend le dernier jour
  targetDate.setDate(Math.min(day, daysInTargetMonth));

  return targetDate;
};

export { expirationDate };
