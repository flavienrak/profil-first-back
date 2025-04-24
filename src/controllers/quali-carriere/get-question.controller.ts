import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { openai } from '../../socket';
import { SectionInterface } from '../../interfaces/cv-minute/section.interface';
import { CvMinuteSectionInterface } from '../../interfaces/cv-minute/cvMinuteSection.interface';
import { SectionInfoInterface } from '../../interfaces/cv-minute/sectionInfo.interface';
import {
  extractJson,
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
} from '../../utils/functions';

const prisma = new PrismaClient();

/*
  CVMINUTE
  CVMINUTESECTION
  SECTIONINFOS
*/

const getQualiCarriereQuestion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    let cvMinute = null;
    let sectionInfos: SectionInfoInterface[] = [];
    let maxExperienceCount = 0;
    let qualiCarriereQuestion = null;
    const { user } = res.locals;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true },
    });

    if (!cvMinute) {
      const cvMinutes = await prisma.cvMinute.findMany({
        where: { userId: user.id },
      });

      if (cvMinutes.length === 0) {
        res.json({ noCvMinute: true });
        return;
      }

      for (const c of cvMinutes) {
        const cvMinuteSections = await prisma.cvMinuteSection.findMany({
          where: { cvMinuteId: c.id },
          include: { sectionInfos: true },
        });

        const sections = await prisma.section.findMany({
          where: {
            id: {
              in: cvMinuteSections.map(
                (section: CvMinuteSectionInterface) => section.sectionId,
              ),
            },
          },
        });

        const getCvMinuteSection = (value: string) => {
          const section = sections.find(
            (s: SectionInterface) =>
              s.name.toLowerCase() === value.toLowerCase(),
          );
          return cvMinuteSections.find(
            (s: CvMinuteSectionInterface) => s.sectionId === section?.id,
          );
        };

        const experiences = getCvMinuteSection('experiences');

        if (
          experiences &&
          experiences.sectionInfos.length > maxExperienceCount
        ) {
          maxExperienceCount = experiences.sectionInfos.length;
          sectionInfos = experiences.sectionInfos;
          cvMinute = c;
        }
      }

      cvMinute = await prisma.cvMinute.update({
        where: { id: cvMinute.id },
        data: { qualiCarriereRef: true },
      });
    } else {
      const cvMinuteSections = await prisma.cvMinuteSection.findMany({
        where: { cvMinuteId: cvMinute.id },
        include: { sectionInfos: true },
      });

      const sections = await prisma.section.findMany({
        where: {
          id: {
            in: cvMinuteSections.map(
              (section: CvMinuteSectionInterface) => section.sectionId,
            ),
          },
        },
      });

      const getCvMinuteSection = (value: string) => {
        const section = sections.find(
          (s: SectionInterface) => s.name.toLowerCase() === value.toLowerCase(),
        );
        return cvMinuteSections.find(
          (s: CvMinuteSectionInterface) => s.sectionId === section?.id,
        );
      };

      const experiences = getCvMinuteSection('experiences');

      maxExperienceCount = experiences.sectionInfos.length;
      sectionInfos = experiences.sectionInfos;
    }

    if (sectionInfos.length === 0) {
      res.json({ noExperiences: true });
      return;
    }

    const totalQuestions = questionNumber(sectionInfos.length);

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResponses = await prisma.qualiCarriereResponse.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    if (
      qualiCarriereQuestions.length === totalQuestions &&
      qualiCarriereResumes.length === sectionInfos.length
    ) {
      const messages = await prisma.qualiCarriereChat.findMany({
        where: { userId: user.id },
      });
      const experiences = await prisma.sectionInfo.findMany({
        where: { id: { in: sectionInfos.map((s) => s.id) } },
        include: { qualiCarriereResumes: true, qualiCarriereCompetences: true },
      });

      res.status(200).json({ nextStep: true, messages, experiences });
      return;
    }

    for (let i = 0; i < sectionInfos.length; i++) {
      const s = sectionInfos[i];
      const userExperience = `title: ${s.title}, date: ${s.date}, company: ${s.company}, contrat: ${s.contrat}, description: ${s.content}`;

      if (qualiCarriereQuestions.length > 0) {
        if (qualiCarriereResponses.length === 0) {
          if (qualiCarriereQuestions[0]?.content.trim().length === 0) {
            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: `
                    Rôle : Tu es un expert RH/coach carrière avec une obsession pour la précision, l’impact et
                    le positionnement de haut niveau dans les CV.
                    Tu dois mener un échange conversationnel avec un candidat afin de qualifier en profondeur
                    une expérience professionnelle et produire la matière brute nécessaire à la rédaction de
                    bullet points puissants pour un CV.
                    Mantra
                    Ta mission principale est de faire parler au maximum le candidat en l’aidant à utiliser les bons
                    mots : ceux qui collent aux attentes du marché et donnent du poids à son parcours. Tu dois :
                    • Détecter les soft et hard skills cachés
                    • Extraire des termes techniques ou les vulgariser
                    • Récupérer des résultats chiffrés ou mesurables
                    • Identifier le niveau de responsabilité réel
                    • Traduire en langage “sexy” ce qui est souvent sous-estimé
                    Logique de l’entretien :
                    1. Contextualisation complète : Où, quand, pourquoi ? Quel enjeu business ? Quelle temporalité ?
                    2. Clarification des tâches : Qu’as-tu fait concrètement ? En autonomie ou pilotage ?
                    3. Précision des outils et méthodes : Avec quoi ? Comment ?
                    4. Interaction & posture : Avec qui ? Quel rôle dans l’équipe ? En transverse ? En frontal ?
                    5. Impacts & résultats : Qu’est-ce qui a changé ? Comment le mesurer ? Témoignage ou effet visible ?
                    6. Lexique CV : Recaler le vocabulaire utilisé vers celui du marché
                    Structure de chaque relance :
                    • Toujours rebondir sur les réponses précédentes (pas de questions en rafale)
                    • Si la réponse est vague : creuse avec “Peux-tu me donner un exemple ?” ou “Comment tu t’y es pris concrètement ?”
                    • Si la personne banalise : valorise, reformule, puis repose une version augmentée
                    • Si c’est trop long ou flou : reformule pour clarifier, puis valide avec “Tu veux dire que…”
                    Objectif final :
                    Réponses riches, concrètes, avec un wording orienté CV, pour rédiger des expériences qui
                    respirent la posture, l’expertise et la clarté de valeur.
                    Règles à suivre:
                    - Basé sur l'expérience de l'utilisateur, poser la question suivante.
                    - Le retour doit contenir :
                      { question: }
                    - Donne la réponse en json simple.
                  `,
                },
                {
                  role: 'user',
                  content: `Expérience: ${userExperience}\n`,
                },
              ],
            });

            if (openaiResponse.id) {
              for (const r of openaiResponse.choices) {
                await prisma.openaiResponse.create({
                  data: {
                    responseId: openaiResponse.id,
                    userId: user.id,
                    request: 'quali-carriere-question',
                    response: r.message.content,
                    index: r.index,
                  },
                });

                const jsonData: { question: string } = extractJson(
                  r.message.content,
                );

                qualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.update({
                    where: { id: qualiCarriereQuestions[0].id },
                    data: {
                      content: jsonData.question.trim().toLocaleLowerCase(),
                    },
                  });

                res.status(201).json({
                  experience: s,
                  qualiCarriereQuestion,
                  totalQuestions,
                });
                return;
              }
            }
          }

          res.status(200).json({
            experience: s,
            qualiCarriereQuestion: qualiCarriereQuestions[0],
            totalQuestions,
          });
          return;
        }

        const lastResponse =
          qualiCarriereResponses[qualiCarriereResponses.length - 1];

        const nextQuestion =
          qualiCarriereQuestions[
            qualiCarriereQuestions.findIndex(
              (q) => q.id === lastResponse.questionId,
            ) + 1
          ];

        if (nextQuestion) {
          if (nextQuestion.content.trim().length === 0) {
            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: `
                    Rôle : Tu es un expert RH/coach carrière avec une obsession pour la précision, l’impact et
                    le positionnement de haut niveau dans les CV.
                    Tu dois mener un échange conversationnel avec un candidat afin de qualifier en profondeur
                    une expérience professionnelle et produire la matière brute nécessaire à la rédaction de
                    bullet points puissants pour un CV.
                    Mantra
                    Ta mission principale est de faire parler au maximum le candidat en l’aidant à utiliser les bons
                    mots : ceux qui collent aux attentes du marché et donnent du poids à son parcours. Tu dois :
                    • Détecter les soft et hard skills cachés
                    • Extraire des termes techniques ou les vulgariser
                    • Récupérer des résultats chiffrés ou mesurables
                    • Identifier le niveau de responsabilité réel
                    • Traduire en langage “sexy” ce qui est souvent sous-estimé
                    Logique de l’entretien :
                    1. Contextualisation complète : Où, quand, pourquoi ? Quel enjeu business ? Quelle temporalité ?
                    2. Clarification des tâches : Qu’as-tu fait concrètement ? En autonomie ou pilotage ?
                    3. Précision des outils et méthodes : Avec quoi ? Comment ?
                    4. Interaction & posture : Avec qui ? Quel rôle dans l’équipe ? En transverse ? En frontal ?
                    5. Impacts & résultats : Qu’est-ce qui a changé ? Comment le mesurer ? Témoignage ou effet visible ?
                    6. Lexique CV : Recaler le vocabulaire utilisé vers celui du marché
                    Structure de chaque relance :
                    • Toujours rebondir sur les réponses précédentes (pas de questions en rafale)
                    • Si la réponse est vague : creuse avec “Peux-tu me donner un exemple ?” ou “Comment tu t’y es pris concrètement ?”
                    • Si la personne banalise : valorise, reformule, puis repose une version augmentée
                    • Si c’est trop long ou flou : reformule pour clarifier, puis valide avec “Tu veux dire que…”
                    Objectif final :
                    Réponses riches, concrètes, avec un wording orienté CV, pour rédiger des expériences qui
                    respirent la posture, l’expertise et la clarté de valeur.
                    Règles à suivre:
                    - Basé sur l'expérience de l'utilisateur, poser la question suivante.
                    - Le retour doit contenir :
                      { question: }
                    - Donne la réponse en json simple.
                  `,
                },
                {
                  role: 'user',
                  content: `Expérience: ${userExperience}\n`,
                },
              ],
            });

            if (openaiResponse.id) {
              for (const r of openaiResponse.choices) {
                await prisma.openaiResponse.create({
                  data: {
                    responseId: openaiResponse.id,
                    userId: user.id,
                    request: 'quali-carriere-question',
                    response: r.message.content,
                    index: r.index,
                  },
                });

                const jsonData: { question: string } = extractJson(
                  r.message.content,
                );

                qualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.update({
                    where: { id: nextQuestion.id },
                    data: {
                      content: jsonData.question.trim().toLocaleLowerCase(),
                    },
                  });

                res.status(201).json({
                  experience: s,
                  qualiCarriereQuestion,
                  totalQuestions,
                });
                return;
              }
            }
          }

          res.status(201).json({
            experience: s,
            qualiCarriereQuestion: nextQuestion,
            totalQuestions,
          });
          return;
        }

        const restQuestions = questionNumberByIndex(i);
        const range = questionRangeByIndex(i);

        const prevQuestions = qualiCarriereQuestions
          .slice(range.start)
          .map(
            (q) =>
              `question: ${q.content}, réponse: ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
          )
          .join('\n');

        if (qualiCarriereQuestions.length === restQuestions) {
          const qualiCarriereResume =
            await prisma.qualiCarriereResume.findFirst({
              where: { sectionInfoId: s.id },
            });

          if (!qualiCarriereResume) {
            const openaiResponse = await openai.chat.completions.create({
              model: 'gpt-4-turbo-preview',
              messages: [
                {
                  role: 'system',
                  content: `
                    Rôle : Tu es un expert RH et coach carrière pragmatique et réputé pour ton efficacité avec une
                    expertise poussée en design de CV à fort impact et en repositionnement professionnel.
                    Tu dois générer une description complète de 2500 caractères minimum et 3 500 caractères
                    maximum, précise et valorisante d’une expérience professionnelle, à partir des réponses du
                    candidat durant un entretien structuré (Quali Carrière).
                    Cette description a un double usage : Elle doit être relue et validée par le candidat : donc elle
                    doit rester fidèle à ce qu’il a dit, dans un ton neutre mais valorisant.
                    Elle sera utilisée par une IA pour générer des CV puissants, adaptés aux offres d’emploi : elle
                    doit donc être riche, précise, exploitable.
                    Voici les règles fondamentales : Tu réutilises l'intégralité des infos contenues dans
                    l’entretien, sans rien oublier.
                    Ton objectif dans la rédaction : donner des éléments ultra professionnels et ultra mobilisable en
                    termes de mots clés du domaine pour valoriser au maximum le profil sans mentir. Toute la
                    description doit être construite pour faciliter l’IA dans la génération de contenu pour le CV.
                    Tu transformes les phrases orales en contenu écrit clair, bien structuré. Structure la synthèse en
                    6 parties :
                    Contexte et enjeux du poste
                    Missions concrètes réalisées
                    Méthodes, outils, canaux et organisation
                    Résultats, apprentissages et posture
                    Vision large du poste (pour ouvrir sur des postes/missions proches)
                    Vision ultra précise du poste (pour fermer sur une ultra spécialisation particulière)
                    Adopte un style précis, professionnel mais accessible.
                    ➤ Pas de tournures vides, pas de bullshit.
                    ➤ Chaque phrase doit pouvoir être utile pour un recruteur. Ne cherche ni à survaloriser
                    artificiellement, ni à édulcorer.
                    ➤ Si c’est du junior, assume-le mais valorise la progression, le goût et le potentiel
                    ➤ Si c’est flou, synthétise avec prudence. Utilise des termes marché à chaque fois que
                    possible.
                    ➤ Si certains éléments sont un peu faibles ou flous, tu les reformules pour les rendre plus clairs
                    et lisibles, sans trahir le fond.
                    Utilisation des anglicismes :
                    Tu es autorisé à employer des termes anglais si le candidat en a utilisé et qu’ils sont :
                    • Couramment utilisés dans le secteur
                    • Et réellement **différenciants** ou **plus lisibles** que leur équivalent français.
                    Intègre-les **uniquement si cela renforce la précision ou la crédibilité métier** (ex : SEA, SEO,
                    landing page, content strategy, brand awareness, lead generation, copywriting…).
                    Ne dépasse **jamais 10% à 20 % de termes en anglais** dans la totalité de la description.
                    Ne remplace pas un mot français pertinent par un anglicisme superflu. Privilégie toujours la clarté
                    et l’impact pour un recruteur français.
                    Règles à suivre:
                    - Basé sur les expériences de l'utilisateur et les entretiens.
                    - Donne 30 compétences tirés des entretiens.
                    - Le retour doit contenir :
                      { resume: , competences: [] }
                    - Donne la réponse en json simple.
                  `,
                },
                {
                  role: 'user',
                  content: `Expérience: ${userExperience}\n Entretien: ${prevQuestions}`,
                },
              ],
            });

            if (openaiResponse.id) {
              for (const r of openaiResponse.choices) {
                await prisma.openaiResponse.create({
                  data: {
                    responseId: openaiResponse.id,
                    userId: user.id,
                    request: 'quali-carriere-resume',
                    response: r.message.content,
                    index: r.index,
                  },
                });
                const jsonData: { resume: string; competences: string[] } =
                  extractJson(r.message.content);

                await prisma.qualiCarriereResume.create({
                  data: {
                    sectionInfoId: s.id,
                    userId: user.id,
                    content: jsonData.resume.trim().toLocaleLowerCase(),
                  },
                });

                for (let i = 0; i < jsonData.competences.length; i++) {
                  const c = jsonData.competences[i];
                  await prisma.qualiCarriereCompetence.create({
                    data: {
                      userId: user.id,
                      sectionInfoId: s.id,
                      content: c,
                    },
                  });
                }
              }
            }
          }

          continue;
        } else if (qualiCarriereQuestions.length < totalQuestions) {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
              {
                role: 'system',
                content: `
                  Rôle : Tu es un expert RH/coach carrière avec une obsession pour la précision, l’impact et
                  le positionnement de haut niveau dans les CV.
                  Tu dois mener un échange conversationnel avec un candidat afin de qualifier en profondeur
                  une expérience professionnelle et produire la matière brute nécessaire à la rédaction de
                  bullet points puissants pour un CV.
                  Mantra
                  Ta mission principale est de faire parler au maximum le candidat en l’aidant à utiliser les bons
                  mots : ceux qui collent aux attentes du marché et donnent du poids à son parcours. Tu dois :
                  • Détecter les soft et hard skills cachés
                  • Extraire des termes techniques ou les vulgariser
                  • Récupérer des résultats chiffrés ou mesurables
                  • Identifier le niveau de responsabilité réel
                  • Traduire en langage “sexy” ce qui est souvent sous-estimé
                  Logique de l’entretien :
                  1. Contextualisation complète : Où, quand, pourquoi ? Quel enjeu business ? Quelle temporalité ?
                  2. Clarification des tâches : Qu’as-tu fait concrètement ? En autonomie ou pilotage ?
                  3. Précision des outils et méthodes : Avec quoi ? Comment ?
                  4. Interaction & posture : Avec qui ? Quel rôle dans l’équipe ? En transverse ? En frontal ?
                  5. Impacts & résultats : Qu’est-ce qui a changé ? Comment le mesurer ? Témoignage ou effet visible ?
                  6. Lexique CV : Recaler le vocabulaire utilisé vers celui du marché
                  Structure de chaque relance :
                  • Toujours rebondir sur les réponses précédentes (pas de questions en rafale)
                  • Si la réponse est vague : creuse avec “Peux-tu me donner un exemple ?” ou “Comment tu t’y es pris concrètement ?”
                  • Si la personne banalise : valorise, reformule, puis repose une version augmentée
                  • Si c’est trop long ou flou : reformule pour clarifier, puis valide avec “Tu veux dire que…”
                  Objectif final :
                  Réponses riches, concrètes, avec un wording orienté CV, pour rédiger des expériences qui
                  respirent la posture, l’expertise et la clarté de valeur.
                  Règles à suivre:
                  - Basé sur l'expérience de l'utilisateur et les entretiens précédents, poser la question suivante.
                  - Le retour doit contenir :
                    { question: }
                  - Donne la réponse en json simple.
                `,
              },
              {
                role: 'user',
                content: `Expérience: ${userExperience}\n Entretien: ${prevQuestions}`,
              },
            ],
          });

          if (openaiResponse.id) {
            for (const r of openaiResponse.choices) {
              await prisma.openaiResponse.create({
                data: {
                  responseId: openaiResponse.id,
                  userId: user.id,
                  request: 'quali-carriere-question',
                  response: r.message.content,
                  index: r.index,
                },
              });

              const jsonData: { question: string } = extractJson(
                r.message.content,
              );

              qualiCarriereQuestion = await prisma.qualiCarriereQuestion.create(
                {
                  data: {
                    userId: user.id,
                    sectionInfoId: s.id,
                    content: jsonData.question.trim().toLocaleLowerCase(),
                    order: qualiCarriereQuestions.length + 1,
                  },
                },
              );

              res.status(201).json({
                experience: s,
                qualiCarriereQuestion,
                totalQuestions,
              });
              return;
            }
          }
        }
      } else {
        const openaiResponse = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: `
                Rôle : Tu es un expert RH/coach carrière avec une obsession pour la précision, l’impact et
                le positionnement de haut niveau dans les CV.
                Tu dois mener un échange conversationnel avec un candidat afin de qualifier en profondeur
                une expérience professionnelle et produire la matière brute nécessaire à la rédaction de
                bullet points puissants pour un CV.
                Mantra
                Ta mission principale est de faire parler au maximum le candidat en l’aidant à utiliser les bons
                mots : ceux qui collent aux attentes du marché et donnent du poids à son parcours. Tu dois :
                • Détecter les soft et hard skills cachés
                • Extraire des termes techniques ou les vulgariser
                • Récupérer des résultats chiffrés ou mesurables
                • Identifier le niveau de responsabilité réel
                • Traduire en langage “sexy” ce qui est souvent sous-estimé
                Logique de l’entretien :
                1. Contextualisation complète : Où, quand, pourquoi ? Quel enjeu business ? Quelle temporalité ?
                2. Clarification des tâches : Qu’as-tu fait concrètement ? En autonomie ou pilotage ?
                3. Précision des outils et méthodes : Avec quoi ? Comment ?
                4. Interaction & posture : Avec qui ? Quel rôle dans l’équipe ? En transverse ? En frontal ?
                5. Impacts & résultats : Qu’est-ce qui a changé ? Comment le mesurer ? Témoignage ou effet visible ?
                6. Lexique CV : Recaler le vocabulaire utilisé vers celui du marché
                Structure de chaque relance :
                • Toujours rebondir sur les réponses précédentes (pas de questions en rafale)
                • Si la réponse est vague : creuse avec “Peux-tu me donner un exemple ?” ou “Comment tu t’y es pris concrètement ?”
                • Si la personne banalise : valorise, reformule, puis repose une version augmentée
                • Si c’est trop long ou flou : reformule pour clarifier, puis valide avec “Tu veux dire que…”
                Objectif final :
                Réponses riches, concrètes, avec un wording orienté CV, pour rédiger des expériences qui
                respirent la posture, l’expertise et la clarté de valeur.
                Règles à suivre:
                - Basé sur l'expérience de l'utilisateur, poser la première question.
                - Le retour doit contenir :
                  { question: }
                - Donne la réponse en json simple.
              `,
            },
            {
              role: 'user',
              content: `Expérience: ${userExperience}`,
            },
          ],
        });

        if (openaiResponse.id) {
          for (const r of openaiResponse.choices) {
            await prisma.openaiResponse.create({
              data: {
                responseId: openaiResponse.id,
                userId: user.id,
                request: 'quali-carriere-question',
                response: r.message.content,
                index: r.index,
              },
            });

            const jsonData: { question: string } = extractJson(
              r.message.content,
            );

            qualiCarriereQuestion = await prisma.qualiCarriereQuestion.create({
              data: {
                userId: user.id,
                sectionInfoId: s.id,
                content: jsonData.question.trim().toLocaleLowerCase(),
                order: 1,
              },
            });

            res.status(201).json({
              experience: s,
              qualiCarriereQuestion,
              totalQuestions,
            });
            return;
          }
        }
      }
    }

    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getQualiCarriereQuestion };
