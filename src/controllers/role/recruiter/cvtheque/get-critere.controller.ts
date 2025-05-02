import express from 'express';

import { PrismaClient } from '@prisma/client';
import { openai } from '../../../../socket';
import { extractJson } from '../../../../utils/functions';

const prisma = new PrismaClient();

const getCvThequeCritere = async (
  req: express.Request,
  res: express.Response,
): Promise<void> => {
  try {
    let cvThequeCritere = null;
    const { id } = req.params;
    cvThequeCritere = await prisma.cvThequeCritere.findUnique({
      where: { id: Number(id) },
      include: { cvThequeCompetences: true, cvThequeUsers: true },
    });

    if (!cvThequeCritere.evaluated) {
      const users = await prisma.user.findMany({
        include: {
          cvMinutes: {
            include: { cvMinuteSections: { include: { sectionInfos: true } } },
          },
        },
      });

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

            const editableSections = sections.filter((s) => s.editable);
            const allCvMinuteSections = editableSections
              .map((s) => {
                const cvMinuteSection = getCvMinuteSection(s.name);
                return `${cvMinuteSection.sectionTitle}: ${cvMinuteSection.sectionInfos[0].content}`;
              })
              .join('\n');

            const messageContent = `
              Contenu du CV :\n
              Expériences : 
              ${experiences.sectionInfos
                .map((item) => `${item.content}`)
                .join('\n')}\n
              Sections : ${allCvMinuteSections}\n
              Offre ciblée : ${cvThequeCritere.position}
            `;

            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: `
                    Tu es expert en rédaction de CV à fort impact.

                    Mission :
                    À partir du contenu du CV et de l’offre ciblée, génère 3 titres de CV percutants.

                    Trois angles attendus :
                    1. **Clair & aligné** : correspondance métier + cohérence parcours
                    2. **Orienté valeur** : bénéfice concret / différenciant pour l’entreprise
                    3. **Original & mémorable** : style, posture ou ADN professionnel unique

                    Contraintes :
                    - Format de réponse : { "titles": [ ... ] }
                    - 1 ligne par titre, **max 80 caractères**
                    - Pas de phrase, pas de ponctuation inutile
                    - Réutilise les bons mots-clés de l’offre
                    - Pas de blabla, sois direct et impactant
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
                    request: 'cvtheque-title',
                    response: r.message.content,
                    index: r.index,
                  },
                });

                const jsonData: { titles: string[] } = extractJson(
                  r.message.content,
                );

                if (!jsonData) {
                  res.json({ parsingError: true });
                  return;
                }

                for (const item of jsonData.titles) {
                  await prisma.cvThequeProposition.create({
                    data: {
                      cvThequeCritereId: cvThequeCritere.id,
                      userId: u.id,
                      section: 'title',
                      content: item,
                    },
                  });
                }
              }
            }
          }
        }
      }

      // cvThequeCritere = await prisma.cvThequeCritere.update({
      //   where: { id: Number(id) },
      //   data: { evaluated: true },
      // });
    }

    res.status(200).json({ cvThequeCritere });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getCvThequeCritere };
