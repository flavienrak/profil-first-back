import express from 'express';

import { PrismaClient } from '@prisma/client';
import { openai } from '../../../../socket';
import { extractJson } from '../../../../utils/functions';
import { cvThequesections } from '../../../../utils/constants';

const prisma = new PrismaClient();

const getCvThequeCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvThequeCritere = null;
    const { id } = req.params;
    const { user } = res.locals;

    cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
      include: { cvThequeCompetences: true },
    });

    if (cvThequeCritere.evaluation === 0) {
      const users = await prisma.user.findMany({
        where: { role: 'user' },
        include: {
          cvMinutes: {
            include: { cvMinuteSections: { include: { sectionInfos: true } } },
          },
        },
      });

      const lines = [`intitulé : ${cvThequeCritere.position}`];

      if (cvThequeCritere.description) {
        lines.push(`description : ${cvThequeCritere.description}`);
      }

      if (cvThequeCritere.cvThequeCompetences.length > 0) {
        const competences = cvThequeCritere.cvThequeCompetences
          .map((c) => c.content)
          .join('\n');
        lines.push(`compétences : ${competences}`);
      }

      if (cvThequeCritere.experience) {
        lines.push(`années d'expérience : ${cvThequeCritere.experience}`);
      }

      if (cvThequeCritere.diplome) {
        lines.push(`niveau de diplôme : ${cvThequeCritere.diplome}`);
      }

      if (cvThequeCritere.localisation) {
        lines.push(`localisation : ${cvThequeCritere.localisation}`);
      }

      if (cvThequeCritere.distance) {
        lines.push(`rayon : ${cvThequeCritere.distance}`);
      }

      const position = lines.join('\n');

      for (const u of users) {
        if (u.cvMinutes.length > 0) {
          let cvMinute = null;
          let maxExperienceCount = 0;

          for (const c of u.cvMinutes) {
            const sections = await prisma.section.findMany({
              where: {
                id: {
                  in: c.cvMinuteSections.map((section) => section.sectionId),
                },
              },
            });

            const getCvMinuteSection = (value: string) => {
              const section = sections.find(
                (s) => s.name.toLowerCase() === value.toLowerCase(),
              );
              return c.cvMinuteSections.find(
                (s) => s.sectionId === section?.id,
              );
            };

            const experiences = getCvMinuteSection('experiences');

            if (
              experiences &&
              experiences.sectionInfos.length > maxExperienceCount
            ) {
              maxExperienceCount = experiences.sectionInfos.length;
              cvMinute = c;
            }
          }

          if (cvMinute) {
            const sections = await prisma.section.findMany({
              where: {
                id: {
                  in: cvMinute.cvMinuteSections.map(
                    (section) => section.sectionId,
                  ),
                },
              },
            });

            const getCvMinuteSection = (value: string) => {
              const section = sections.find(
                (s) => s.name.toLowerCase() === value.toLowerCase(),
              );
              return cvMinute.cvMinuteSections.find(
                (s) => s.sectionId === section?.id,
              );
            };

            const experiences = getCvMinuteSection('experiences');

            if (experiences.sectionInfos.length > 0) {
              let messageContent = '';
              const editableSections = sections.filter((s) => s.editable);
              const allCvMinuteSections = editableSections
                .map((s) => {
                  const cvMinuteSection = getCvMinuteSection(s.name);
                  return `${cvMinuteSection.sectionTitle} : ${cvMinuteSection.sectionInfos[0].content}`;
                })
                .join('\n');

              if (u.qualiCarriere === 'active') {
                const qualiCarriereResumes =
                  await prisma.qualiCarriereResume.findMany({
                    where: { userId: u.id },
                  });

                messageContent = `
                  Contenus du CV :\n
                  Expériences : 
                  ${experiences.sectionInfos
                    .map(
                      (item) =>
                        `${item.date}, ${item.company}, ${item.title} : ${item.content}`,
                    )
                    .join('\n')}\n
                  Sections : ${allCvMinuteSections}\n
                  Résumé : ${qualiCarriereResumes.map((r) => r.content).join('\n')}
                  Offre ciblée : ${position}
                `;
              } else {
                messageContent = `
                  Contenus du CV :\n
                  Expériences : 
                  ${experiences.sectionInfos
                    .map(
                      (item) =>
                        `${item.date}, ${item.company}, ${item.title} : ${item.content}`,
                    )
                    .join('\n')}\n
                  Sections : ${allCvMinuteSections}\n
                  Offre ciblée : ${position}
                `;
              }

              const openaiResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: `
                      Tu es expert en rédaction de CV et en analyse d’adéquation avec les offres d’emploi.
  
                      Objectif :
                      Évaluer la compatibilité entre le contenu d'un CV et une offre ciblée, en attribuant un score de 0 à 100.
  
                      Règles de compatibilité :
                      - Si le score est strictement supérieur à 50, considérer le CV comme compatible.
                      - Sinon, considérer comme non compatible.
  
                      Format attendu :
                      {
                        "compatible": "true" ou "false",
                        "score": "valeur entre 0 et 100"
                      }
                    `.trim(),
                  },
                  {
                    role: 'user',
                    content: messageContent.trim(),
                  },
                ],
              });

              if (openaiResponse.id) {
                for (const r of openaiResponse.choices) {
                  await prisma.openaiResponse.create({
                    data: {
                      responseId: openaiResponse.id,
                      userId: u.id,
                      request: 'cvtheque-evaluation',
                      response: r.message.content,
                      index: r.index,
                    },
                  });

                  const jsonData: { compatible: boolean; score: number } =
                    extractJson(r.message.content);

                  if (!jsonData) {
                    res.json({ parsingError: true });
                    return;
                  }

                  if (jsonData.compatible) {
                    const existCvThequeUser =
                      await prisma.cvThequeUser.findUnique({
                        where: {
                          userId_cvThequeCritereId: {
                            userId: u.id,
                            cvThequeCritereId: cvThequeCritere.id,
                          },
                        },
                      });

                    if (!existCvThequeUser) {
                      await prisma.cvThequeUser.create({
                        data: {
                          score: jsonData.score,
                          userId: u.id,
                          cvThequeCritereId: cvThequeCritere.id,
                        },
                      });
                    }

                    const cvMinuteCount = await prisma.cvMinute.count({
                      where: { cvThequeCritereId: cvThequeCritere.id },
                    });

                    const name = `Profil First ${cvMinuteCount + 1}`;

                    const newCvMinute = await prisma.cvMinute.create({
                      data: {
                        name,
                        userId: u.id,
                        position: cvThequeCritere.position,
                        cvThequeCritereId: cvThequeCritere.id,
                        generated:
                          u.qualiCarriere === 'active' ? 'dynamic' : 'static',
                      },
                    });

                    for (const s of cvThequesections) {
                      let section = await prisma.section.findUnique({
                        where: { name: s.name.trim().toLowerCase() },
                      });

                      if (!section) {
                        section = await prisma.section.create({
                          data: {
                            name: s.name.trim().toLowerCase(),
                            editable: true,
                          },
                        });
                      }

                      const cvMinuteSection =
                        await prisma.cvMinuteSection.create({
                          data: {
                            cvMinuteId: newCvMinute.id,
                            sectionId: section.id,
                            sectionOrder: s.order,
                            sectionTitle: s.name.trim(),
                          },
                        });

                      if (s.name === 'title') {
                        // TITLE
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                  Tu es expert en rédaction de CV à fort impact.
  
                                  Mission :
                                  À partir des contenus du CV et de l’offre ciblée, génère un **titre de CV** clair, direct et cohérent avec le poste visé.
  
                                  Objectifs :
                                  - Valoriser la cohérence du parcours
                                  - Utiliser les bons mots-clés du métier
                                  - Affirmer un positionnement professionnel net
  
                                  Contraintes :
                                  - 1 ligne, maximum 80 caractères
                                  - Pas de phrase complète ni de ponctuation inutile
  
                                  Format attendu :
                                  { "content": "..." }
                              `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-title',
                                response: r.message.content,
                                index: r.index,
                              },
                            });

                            const jsonData: { content: string } = extractJson(
                              r.message.content,
                            );

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                content: jsonData.content,
                              },
                            });
                          }
                        }
                      } else if (s.name === 'presentation') {
                        // PRESENTATION
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                  Tu es expert en rédaction de CV à fort impact.
  
                                  Mission :
                                  À partir des contenus du CV et de l’offre ciblée, rédige une **phrase d’accroche professionnelle** sobre et crédible, centrée sur l’expertise et la cohérence du parcours.
  
                                  Objectifs :
                                  - Montrer une progression logique
                                  - Positionner clairement le rôle cible
                                  - Mettre en valeur les savoir-faire clés
  
                                  Contraintes :
                                  - 1 à 2 phrases, ton neutre et structuré
                                  - Maximum 200 caractères
                                  - Pas d'effet de style, pas d’exagération
  
                                  Format attendu :
                                  { "content": "..." }
                              `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-presentation',
                                response: r.message.content,
                                index: r.index,
                              },
                            });

                            const jsonData: { content: string } = extractJson(
                              r.message.content,
                            );

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                content: jsonData.content,
                              },
                            });
                          }
                        }
                      } else if (s.name === 'experiences') {
                        // EXPERIENCES
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                    Tu es expert en rédaction de CV à fort impact.
  
                                    Objectif global :
                                    À partir des contenus du CV et de l'offre ciblée, reformule chaque expérience de manière à :
                                    - Générer une accroche professionnelle claire
                                    - Calculer la durée (avec +1 mois)
                                    - Anonymiser l’organisation
                                    - Reformuler les missions pour maximiser l’alignement avec l’offre
  
                                    1. Phrase d’accroche :
                                    - Ton neutre et structuré
                                    - 1 à 2 phrases max ≤ 200 caractères
                                    - Pas d’effet de style ni exagération
  
                                    2. Durée de l’expérience :
                                    - Calcule la durée en mois (fin - début + 1 mois)
                                    - Affiche uniquement la durée, format : "26 mois", "14 mois", etc.
                                    - Ne jamais mentionner les dates.
  
                                    3. Anonymisation de l’organisation :
                                    Analyse le nom + contexte, puis remplace l’entreprise par :
                                    [Type d’organisation] – secteur [Secteur] – [Marché] – portée [Portée géographique]
  
                                    → Utilise les valeurs suivantes :
  
                                    • Type d’organisation :
                                    STARTUP | PME | ETI | GRAND_GROUPE | INSTITUTION_PUBLIQUE | ONG | ORG_ETUDIANTE | ASSO_BENEVOLE | PROJET_UNIVERSITAIRE | INDEPENDANT
  
                                    • Secteur principal :
                                    TECH | INDUSTRIE | ENERGIE | LUXE | FINANCE | SANTE | AGROALIM | TRANSPORT | EDUCATION | CONSEIL | MEDIAS | COLLECTIVITE | ONG_SECTEUR | EVENT_ETUDIANT | IMPACT_SOCIAL | RH
  
                                    • Marché cible :
                                    B2B | B2C | B2G | MIXTE | NON_MARCHAND
  
                                    • Portée géographique :
                                    NATIONAL | EUROPEEN | INTERNATIONAL | CAMPUS
  
                                    4. Reformulation “fit de poste” :
                                    - Reformule les missions sous forme de 5 bullet points max.
                                    - Respecte le format :  
                                      "Xxxxxx : verbe d’action + missions clés (150 à 290 caractères)"
                                    - Basé sur l’expérience réelle + attendus de l’offre.
                                    - Vocabulaire professionnel, factuel, sans extrapolation.
  
                                    Format attendu :
                                    [
                                      {
                                        "title": "Accroche",
                                        "date": "Durée",
                                        "company": "Type – secteur – marché – portée",
                                        "description": "• Bullet point 1\\n• Bullet point 2\\n..."
                                      }
                                    ]
                                `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-experience',
                                response: r.message.content,
                                index: r.index,
                              },
                            });
                            const jsonData: {
                              title: string;
                              date: string;
                              company: string;
                              description: string;
                            }[] = extractJson(r.message.content);

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            for (let i = 0; i < jsonData.length; i++) {
                              const item = jsonData[i];
                              await prisma.sectionInfo.create({
                                data: {
                                  cvMinuteSectionId: cvMinuteSection.id,
                                  title: item.title,
                                  content: item.description,
                                  date: item.date,
                                  company: item.company,
                                  order: i + 1,
                                },
                              });
                            }
                          }
                        }
                      } else if (s.name === 'diplomes') {
                        // DIPLOMES
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                  Tu es expert en rédaction de CV à fort impact.
  
                                  Mission :
                                  À partir du contenu du CV et de l’offre ciblée, reformuler et structurer chaque diplôme selon un format standardisé, en regroupant toutes les entrées dans un **seul contenu**, séparées par des retours à la ligne.
  
                                  Consignes impératives pour CHAQUE diplôme :
  
                                  1. Reformulation de l’intitulé :
                                  - Sujet = intitulé reformulé en termes universels (sans jargon)
                                  - Max. 20 caractères (espaces inclus)
  
                                  2. Niveau :
                                  - Bac +X (si diplôme non standard)
                                  - Master / Maîtrise / Licence / BTS (si diplôme standard)
  
                                  3. Type d’établissement (1 seul choix) :
                                  [Université historique | Grande école | École spécialisée | Centre certifié]
  
                                  4. Reconnaissance :
                                  - Formulation nuancée entre 1 et 7 mots
                                  - Exemples : "Top évidence internationale", "Référence académique majeure", "Reconnue sectoriellement", "Pertinente localement"
  
                                  5. Réputation :
                                  - Note : de ★☆☆☆☆ à ★★★★★
                                  - Commentaire court : ex. "Prestige académique", "Rayonnement modéré", "Expertise sectorielle"
  
                                  Format de sortie strict :
                                  Sujet : [Intitulé reformulé]  
                                  Niveau : [Bac +X ou Master/Maîtrise/Licence/BTS]  
                                  Type d'établissement : [Catégorie]  
                                  Reconnaissance : [Description en 1-7 mots]  
                                  Réputation : [★☆☆☆☆ à ★★★★★] + [Commentaire]
  
                                  Interdictions :
                                  - Aucun texte hors format
                                  - Ne jamais citer le nom de l’établissement
                                  - Aucune abréviation non universelle
                                  - Aucune spécialisation technique
  
                                  Format attendu :
                                  { "content": "\
                                      Sujet : [Intitulé reformulé]\n\
                                      Niveau : [Bac +X ou diplôme standard]\n\
                                      Type d'établissement : [Catégorie]\n\
                                      Reconnaissance : [Description nuancée]\n\
                                      Réputation : [★☆☆☆☆ à ★★★★★] + [Commentaire]\n\
                                      \n\
                                      Sujet : ...\n\
                                      Niveau : ...\n\
                                      Type d'établissement : ...\n\
                                      Reconnaissance : ...\n\
                                      Réputation : ...\
                                    "
                                  }
                              `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-diplomes',
                                response: r.message.content,
                                index: r.index,
                              },
                            });

                            const jsonData: { content: string } = extractJson(
                              r.message.content,
                            );

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                content: jsonData.content,
                              },
                            });
                          }
                        }
                      } else if (s.name === 'formation') {
                        // FORMATION
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                  Tu es expert en rédaction de CV à fort impact.
  
                                  Mission :
                                  À partir du contenu du CV et de l’offre ciblée, sélectionne **la formation la plus valorisable pour le poste visé** et affiche-la de manière sobre, professionnelle et lisible.
  
                                  Règles de sélection :
                                  - Priorité : reconnue > renforçante > pertinente pour le domaine
                                  - Une seule formation mise en valeur
                                  - Les autres sont mentionnées sans détail
  
                                  Rédaction :
                                  - Jamais de mots comme "initiation", "notions", "bases"
                                  - Phrase structurée ainsi :
                                    [Poids] – [Thème professionnel valorisé, 5 à 8 mots] | [Organisme connu ou nom raccourci]  
                                    + X autres dont X reconnue / renforçante / pertinente pour le domaine
  
                                  Format attendu :
                                  { "content": "..." }
                              `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-formation',
                                response: r.message.content,
                                index: r.index,
                              },
                            });

                            const jsonData: { content: string } = extractJson(
                              r.message.content,
                            );

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                content: jsonData.content,
                              },
                            });
                          }
                        }
                      } else if (s.name === 'competence') {
                        // COMPETENCE
                        const openaiSectionResponse =
                          await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                              {
                                role: 'system',
                                content: `
                                  Tu es expert en rédaction de CV à fort impact.
  
                                  Mission :
                                  À partir du contenu du CV et de l’offre ciblée, génère **4 compétences clés** à afficher.
  
                                  Contraintes :
                                  - Formulation synthétique (2 à 4 mots)
                                  - Reflète des actions réellement réalisées
                                  - Alignée avec les attentes de l’offre
                                  - Sans redondance avec la description de poste
                                  - Pas de jargon vide, uniquement des termes concrets et parlants
  
                                  Inputs à croiser :
                                  - Expériences et intitulés du CV
                                  - Offre d’emploi ciblée
  
                                  Cas spécifique outil :
                                  Si un **type d’outil** (ex. reporting, gestion de projet, coordination) est maîtrisé par le candidat **et** explicitement requis dans l’offre, la dernière ligne peut être :
                                  **Outils de [type]**
  
                                  Format de sortie :
                                  - Une compétence par ligne
                                  - Une ligne vide entre chaque compétence
                                  - Total : 4 lignes (la dernière peut être "Outils de [type]")
  
                                  Format attendu :
                                  { "content": "..." }

                                  Exemple attendu :
                                  {
                                    "content": "Compétence 1\\n\\nCompétence 2\\n\\nCompétence 3\\n\\nCompétence 4 ou Outils de [type]"
                                  }
                              `.trim(),
                              },
                              {
                                role: 'user',
                                content: messageContent.trim(),
                              },
                            ],
                          });

                        if (openaiSectionResponse.id) {
                          for (const r of openaiSectionResponse.choices) {
                            await prisma.openaiResponse.create({
                              data: {
                                responseId: openaiSectionResponse.id,
                                userId: u.id,
                                request: 'cvtheque-competence',
                                response: r.message.content,
                                index: r.index,
                              },
                            });

                            const jsonData: { content: string } = extractJson(
                              r.message.content,
                            );

                            if (!jsonData) {
                              res.json({ parsingError: true });
                              return;
                            }

                            await prisma.sectionInfo.create({
                              data: {
                                cvMinuteSectionId: cvMinuteSection.id,
                                content: jsonData.content,
                              },
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      cvThequeCritere = await prisma.cvThequeCritere.update({
        where: { id: cvThequeCritere.id },
        data: { evaluation: 1 },
      });
    }

    cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: cvThequeCritere.id },
      include: {
        cvThequeCompetences: true,
        cvThequeUsers: true,
        cvMinutes: true,
      },
    });

    res.status(200).json({ cvThequeCritere });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getCvThequeCritere };
