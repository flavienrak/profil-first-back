import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { io, openai } from '../../../../socket';
import { CvMinuteSectionInterface } from '../../../../interfaces/role/user/cv-minute/cvMinuteSection.interface';
import {
  extractJson,
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
} from '../../../../utils/functions';

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
    let qualiCarriereQuestion = null;
    const { user } = res.locals;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    cvMinute = await prisma.cvMinute.findFirst({
      where: { qualiCarriereRef: true, userId: user.id },
    });

    if (!cvMinute) {
      const cvMinutes = await prisma.cvMinute.findMany({
        where: { userId: user.id },
        include: {
          cvMinuteSections: {
            include: {
              sectionInfos: true,
            },
          },
        },
      });

      if (cvMinutes.length === 0) {
        res.json({ noCvMinute: true });
        return;
      }

      let bestCvMinute = null;
      let maxExperienceCount = 0;
      let bestCvMinuteSections: CvMinuteSectionInterface[] = [];

      for (const c of cvMinutes) {
        const experiences = c.cvMinuteSections.find(
          (s) =>
            s.sectionInfos.length > 0 &&
            s.sectionInfos[0].title?.toLowerCase().includes('experience'),
        );

        if (
          experiences &&
          experiences.sectionInfos.length > maxExperienceCount
        ) {
          maxExperienceCount = experiences.sectionInfos.length;
          bestCvMinute = c;
          bestCvMinuteSections = c.cvMinuteSections;
        }
      }

      if (!bestCvMinute) {
        res.json({ noCvMinute: true });
        return;
      }

      // Création du nouveau cvMinute avec qualiCarriereRef
      const newCvMinute = await prisma.cvMinute.create({
        data: {
          position: bestCvMinute.position,
          name: bestCvMinute.name,
          primaryBg: bestCvMinute.primaryBg,
          secondaryBg: bestCvMinute.secondaryBg,
          tertiaryBg: bestCvMinute.tertiaryBg,
          userId: bestCvMinute.userId,
          visible: bestCvMinute.visible,
          qualiCarriereRef: true,
        },
      });

      for (const s of bestCvMinuteSections) {
        const newSection = await prisma.cvMinuteSection.create({
          data: {
            cvMinuteId: newCvMinute.id,
            sectionId: s.sectionId,
            sectionOrder: s.sectionOrder,
            sectionTitle: s.sectionTitle,
          },
        });

        const sectionInfosToCreate = s.sectionInfos.map((info) => ({
          cvMinuteSectionId: newSection.id,
          title: info.title,
          content: info.content,
          date: info.date,
          company: info.company,
          contrat: info.contrat,
          icon: info.icon,
          iconSize: info.iconSize,
          order: info.order,
        }));

        await prisma.sectionInfo.createMany({ data: sectionInfosToCreate });
      }

      cvMinute = newCvMinute;
    }

    // Chargement final des données nécessaires
    const cvMinuteSections = await prisma.cvMinuteSection.findMany({
      where: { cvMinuteId: cvMinute.id },
      include: { sectionInfos: true },
    });

    const sectionIds = cvMinuteSections.map((s) => s.sectionId);
    const sections = await prisma.section.findMany({
      where: { id: { in: sectionIds } },
    });

    const getCvMinuteSection = (value: string) => {
      const section = sections.find(
        (s) => s.name.toLowerCase() === value.toLowerCase(),
      );
      return cvMinuteSections.find((s) => s.sectionId === section?.id);
    };

    const experiencesSection = getCvMinuteSection('experiences');

    if (!experiencesSection || experiencesSection.sectionInfos.length === 0) {
      res.json({ noExperiences: true });
      return;
    }

    const sectionInfos = experiencesSection.sectionInfos;

    const qualiCarriereQuestions = await prisma.qualiCarriereQuestion.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResponses = await prisma.qualiCarriereResponse.findMany({
      where: { userId: user.id },
    });
    const qualiCarriereResumes = await prisma.qualiCarriereResume.findMany({
      where: { userId: user.id },
    });

    const totalQuestions = questionNumber(sectionInfos.length);

    const lastResponse =
      qualiCarriereResponses[qualiCarriereResponses.length - 1];

    const nextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex(
          (q) => q.id === lastResponse?.questionId,
        ) + 1
      ];

    const afterNextQuestion =
      qualiCarriereQuestions[
        qualiCarriereQuestions.findIndex((q) => q.id === nextQuestion?.id) + 1
      ];

    if (qualiCarriereResponses.length === totalQuestions) {
      const messages = await prisma.qualiCarriereChat.findMany({
        where: { userId: user.id },
      });
      const experiences = await prisma.sectionInfo.findMany({
        where: { id: { in: sectionInfos.map((s) => s.id) } },
        include: { qualiCarriereResumes: true, qualiCarriereCompetences: true },
      });

      if (qualiCarriereResumes.length === sectionInfos.length) {
        res.status(200).json({ nextStep: true, messages, experiences });
        return;
      } else {
        for (let i = 0; i < sectionInfos.length; i++) {
          const s = sectionInfos[i];
          const userExperience = `title : ${s.title}, date : ${s.date}, company : ${s.company}, contrat : ${s.contrat}, description : ${s.content}`;

          const restQuestions = questionNumberByIndex(i);
          const range = questionRangeByIndex(i);

          const prevQuestions = qualiCarriereQuestions
            .slice(range.start)
            .map(
              (q) =>
                `question : ${q.content}, réponse : ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
            )
            .join('\n');

          if (qualiCarriereResponses.length >= restQuestions) {
            const qualiCarriereResume =
              await prisma.qualiCarriereResume.findUnique({
                where: { sectionInfoId: s.id },
              });

            if (!qualiCarriereResume) {
              const openaiResponse = await openai.chat.completions.create({
                model: 'gpt-4-turbo-preview',
                messages: [
                  {
                    role: 'system',
                    content: `
                      Tu es un expert RH et coach carrière reconnu pour ton efficacité. Tu excelles dans le design de CV percutants et le repositionnement professionnel.

                      Ta mission :
                      - Générer une **description d'expérience professionnelle** entre 2 500 et 3 500 caractères.
                      - Cette description servira à la fois à être validée par le candidat et à être utilisée par une IA pour générer un CV puissant.
                      - Elle doit donc être **fidèle**, **neutre**, **valorisante**, **riche**, **précise**, et **exploitable**.
                      - Réutilise **toutes** les informations de l’entretien, sans rien omettre.
                      - Aucune phrase creuse ni jargon inutile. Ton style est **professionnel, clair, structuré, impactant.**

                      Structure exigée en 6 parties :
                      1. Contexte et enjeux du poste  
                      2. Missions concrètes réalisées  
                      3. Méthodes, outils, canaux, organisation  
                      4. Résultats, apprentissages, posture  
                      5. Vision large du poste (ouvertures possibles)  
                      6. Vision ultra précise (ultra spécialisation)

                      Anglicismes :
                      - Utilisés seulement s’ils sont : courants dans le secteur, différenciants, et plus clairs.
                      - Limite : 10 à 20 % du texte maximum.
                      - Ne jamais remplacer un mot français pertinent.

                      Deuxième objectif :
                      Génère une **liste de 30 compétences clés** mobilisées dans cette expérience, même si non dites explicitement par le candidat :
                      - Minimum 10 doivent être totalement invisibles pour lui.
                      - Une au moins doit être liée à la réussite ou conception d’un projet, sans qu’il en ait conscience.
                      - Format attendu :
                        (nom de la compétence) = (illustration concrète issue des faits)
                      - Privilégie des termes métiers, précis et actionnables.
                      - Évite les soft skills vagues ou évidentes (ex : rigueur, curiosité…).
                      - Ne reformule pas plusieurs fois une même idée.

                      Le tout doit être structuré comme suit :

                      {
                        resume: "...",
                        competences: ["...", "...", ...]
                      }
                    `.trim(),
                  },
                  {
                    role: 'user',
                    content: `
                      Expérience : ${userExperience}\n
                      Entretien structuré : ${prevQuestions}
                    `.trim(),
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

                  if (!jsonData) {
                    res.json({ parsingError: true });
                    return;
                  }

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
          }
        }

        res.status(200).json({ nextStep: true, messages, experiences });
        return;
      }
    } else {
      for (let i = 0; i < sectionInfos.length; i++) {
        const s = sectionInfos[i];
        const userExperience = `title : ${s.title}, date : ${s.date}, company : ${s.company}, contrat : ${s.contrat}, description : ${s.content}`;

        if (qualiCarriereQuestions.length > 0) {
          if (qualiCarriereResponses.length === 0) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience: s,
              question: qualiCarriereQuestions[0],
              totalQuestions,
            });

            res.status(200).json({ nextQuestion: true });
            return;
          }

          const restQuestions = questionNumberByIndex(i);
          const range = questionRangeByIndex(i);

          const prevQuestions = qualiCarriereQuestions
            .slice(range.start)
            .map(
              (q) =>
                `question : ${q.content}, réponse : ${qualiCarriereResponses.find((r) => r.questionId === q.id)?.content}`,
            )
            .join('\n');

          if (
            qualiCarriereResponses.length <= restQuestions - 1 &&
            nextQuestion
          ) {
            io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
              experience: sectionInfos.find(
                (sInfo) => sInfo.id === nextQuestion.sectionInfoId,
              ),
              question: nextQuestion,
              totalQuestions,
            });

            if (
              !afterNextQuestion &&
              qualiCarriereResponses.length < restQuestions - 1
            ) {
              const openaiResponse = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                  {
                    role: 'system',
                    content: `
                      Tu es un expert RH / coach carrière, spécialiste de la formulation d’expériences percutantes pour le CV.

                      Objectif :
                      Mener un échange conversationnel avec un candidat pour qualifier une expérience pro et récolter les bons mots pour rédiger des bullet points à fort impact.

                      Ton rôle :
                      - Faire parler le candidat au maximum, avec un vocabulaire orienté marché.
                      - Extraire :
                        • Soft & hard skills dissimulés
                        • Résultats chiffrés / mesurables
                        • Outils, méthodes, techniques
                        • Niveaux de responsabilité
                        • Formulations puissantes adaptées aux recruteurs

                      Logique d’entretien (à suivre en boucle) :
                      1. Contexte : Où ? Quand ? Pourquoi ? Enjeux ?
                      2. Tâches : Qu’as-tu fait concrètement ? Seul ou en équipe ?
                      3. Outils & méthodes : Comment ? Avec quoi ?
                      4. Interactions : Avec qui ? Quel rôle ? (hiérarchie, transversalité…)
                      5. Impacts : Résultats visibles ? KPIs ? Chiffres ? Progrès ?
                      6. Reformulation CV : Transformer ce qui est banal ou flou en langage CV clair et vendeur

                      Règles d’interaction :
                      - Toujours rebondir sur la réponse précédente (pas de rafale de questions).
                      - Si flou : "Peux-tu donner un exemple ?" / "Comment t’y es-tu pris ?"
                      - Si banal : Reformule pour valoriser, puis pose une version améliorée.
                      - Si long ou confus : Clarifie et valide ("Tu veux dire que… ?")

                      Format de sortie :
                      {
                        question: "ta relance puissante ici (max 110 caractères)"
                      }
                    `.trim(),
                  },
                  {
                    role: 'user',
                    content: `Expérience :\n${userExperience}\n\nEntretien précédent :\n${prevQuestions}`,
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

                  if (!jsonData) {
                    res.json({ parsingError: true });
                    return;
                  }

                  if (jsonData) {
                    await prisma.qualiCarriereQuestion.create({
                      data: {
                        userId: user.id,
                        sectionInfoId: s.id,
                        content: jsonData.question.trim().toLocaleLowerCase(),
                        order: qualiCarriereQuestions.length + 1,
                      },
                    });

                    res.status(200).json({ nextQuestion: true });
                    return;
                  }
                }
              }
            }
          }
        } else {
          const openaiResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `
                  Tu es un expert RH/coach carrière spécialisé dans l'optimisation de CV à fort impact.

                  Objectif :
                  Qualifier une expérience professionnelle via un échange pour extraire les éléments clés d’un bon CV.

                  Ce que tu dois identifier :
                  - Soft/hard skills implicites
                  - Responsabilités réelles
                  - Résultats chiffrés ou visibles
                  - Outils, méthodes et contextes
                  - Vocabulaire orienté marché

                  Méthode :
                  1. Contexte : Où ? Quand ? Pourquoi ? Enjeux ?
                  2. Tâches : Quoi exactement ? Autonomie ou pilotage ?
                  3. Outils & méthodes : Comment ? Avec quoi ?
                  4. Interactions : Avec qui ? Rôle exact ?
                  5. Résultats : Changement mesurable ou visible ?
                  6. Lexique : Reformuler pour CV

                  Ton style :
                  - Rebondis toujours sur les réponses précédentes
                  - Creuse les réponses vagues (“Un exemple ?” / “Concrètement ?”)
                  - Reformule ce qui est flou ou banalisé (“Tu veux dire que…”)

                  Format attendu :
                  - Basé sur l’expérience utilisateur
                  - Génère les **2 premières questions** de l’échange
                  - Format JSON :
                    {
                      "questions": [
                        "Question 1 (max 110 caractères)",
                        "Question 2 (max 110 caractères)"
                      ]
                    }
                `.trim(),
              },
              {
                role: 'user',
                content: `Expérience : ${userExperience}`.trim(),
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

              const jsonData: { questions: string } = extractJson(
                r.message.content,
              );

              if (!jsonData) {
                res.json({ parsingError: true });
                return;
              }

              for (let i = 0; i < jsonData.questions.length; i++) {
                const q = jsonData.questions[i];
                const newQualiCarriereQuestion =
                  await prisma.qualiCarriereQuestion.create({
                    data: {
                      userId: user.id,
                      sectionInfoId: s.id,
                      content: q.trim().toLocaleLowerCase(),
                      order: qualiCarriereQuestions.length + i + 1,
                    },
                  });

                if (i === 0) {
                  qualiCarriereQuestion = newQualiCarriereQuestion;
                }
              }

              io.to(`user-${user.id}`).emit('qualiCarriereQuestion', {
                experience: s,
                question: qualiCarriereQuestion,
                totalQuestions,
              });

              res.status(200).json({ nextQuestion: true });
              return;
            }
          }
        }
      }
    }

    res.status(200).json({ nextQuestion: true });
    return;
  } catch (error) {
    res.status(500).json({ error: `${error.message}` });
    return;
  }
};

export { getQualiCarriereQuestion };
