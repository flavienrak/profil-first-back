import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import prisma from '@/lib/db';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { extractJson, formatTextWithStrong } from '@/utils/functions';
import { formattedDate } from '@/utils/constants';
import { addCvMinutePrompt } from '@/utils/prompts/cv-minute.prompt';
import { gpt4 } from '@/utils/openai';
import { UserInterface } from '@/interfaces/user.interface';
import { PaymentInterface } from '@/interfaces/payment.interface';
import { inputToken, outputToken } from '@/utils/payment/token';
import { updateCvMinutePayments } from './updateCvMinutePayments';

const uniqueId = crypto.randomBytes(4).toString('hex');

const addCvMinute = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const {
      user,
      cvMinuteCount,

      freeCard,
      premiumCards,
      boosterCards,

      totalCredits,
    } = res.locals as {
      user: UserInterface;
      cvMinuteCount: number;

      freeCard: PaymentInterface;
      premiumCards: PaymentInterface[];
      boosterCards: PaymentInterface[];

      totalCredits: number;
    };

    const body: { position: string } = req.body;

    const name = `CV du ${formattedDate}`;

    let cvMinute = await prisma.cvMinute.create({
      data: {
        position: body.position.trim(),
        userId: user.id,
        name,
      },
    });

    // MIME TYPE
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!req.file) {
      res.json({ fileNotFound: true });
      return;
    } else if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.json({ invalidDocument: true });
      return;
    } else {
      let textData = '';
      if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(req.file.buffer);
        textData = pdfData.text;
      } else {
        const wordData = await mammoth.extractRawText({
          buffer: req.file.buffer,
        });
        textData = wordData.value;
      }

      const normalized = textData.replace(/(\r?\n\s*){2,}/g, '\\n').trim();

      // TOKEN
      let inputTokens = inputToken('gpt-4', normalized);
      let outputTokens = outputToken('gpt-4', normalized);
      let totalTokens = inputTokens + outputTokens;

      if (cvMinuteCount > 0) {
        if (totalCredits < totalTokens) {
          res.json({ notAvailable: true });
          return;
        }
      }

      const extension = path.extname(req.file.originalname);
      const fileName = `cv-${user.id}-${Date.now()}-${uniqueId}${extension}`;
      const uploadsBase = path.join(process.cwd(), 'uploads');
      const directoryPath = path.join(uploadsBase, `/files/user-${user.id}`);
      const filePath = path.join(directoryPath, fileName);

      if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
      }
      fs.writeFileSync(filePath, req.file.buffer);

      await prisma.file.create({
        data: {
          name: fileName,
          extension,
          originalName: req.file.originalname,
          usage: 'cvMinute',
          userId: user.id,
          cvMinuteId: cvMinute.id,
        },
      });

      cvMinute = await prisma.cvMinute.update({
        where: { id: cvMinute.id },
        data: { content: normalized },
      });

      const systemPrompt = addCvMinutePrompt.trim();
      const userPrompt = `
        CV : ${normalized}\n

        Offre ciblée :
        ${body.position}
      `.trim();

      // OPENAI
      const openaiResponse = await gpt4([
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: userPrompt,
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      inputTokens = inputToken('gpt-4', systemPrompt + userPrompt);

      const responseChoice = openaiResponse.choices[0];

      if (responseChoice.message.content) {
        outputTokens = outputToken('gpt-4', responseChoice.message.content);

        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-infos',
            response: responseChoice.message.content,
            index: responseChoice.index,
          },
        });

        const jsonData: {
          name: string;
          firstname: string;
          contacts: {
            contactIcon: string;
            contactContent: string;
            contactOrder: string;
          }[];
          cvTitle: {
            title: string;
            titleAdvice: string;
          };
          profilePresentation: {
            presentation: string;
            presentationAdvice: string;
          };
          experiences: {
            postTitle: string;
            postDate: string;
            postCompany: string;
            postContrat: string;
            postDescription: string;
            postOrder: string;
            postScore: string;
            postHigh: string;
            postWeak: string;
          }[];
          sections: {
            sectionName: string;
            sectionContent: string;
            sectionOrder: string;
            sectionAdvice: string;
          }[];
          domains: string[];
          newSectionsAdvice: string;
          evaluations: {
            globalScore: string;
            recommendations: string;
          };
        } = extractJson(responseChoice.message.content);

        if (!jsonData) {
          res.json({ parsingError: true });
          return;
        }

        const allSections: {
          name: string;
          title?: string;
          order?: string;
          editable?: boolean;
          advice?: string;
          content?:
            | string
            | {
                title?: string;
                content?: string;
                date?: string;
                company?: string;
                contrat?: string;
                icon?: string;
                iconSize?: number;
                order?: string;

                score?: string;
                high?: string;
                weak?: string;
              }[];
        }[] = [
          { name: 'profile', content: 'cvMinute-profile' },
          { name: 'name', content: jsonData.name },
          { name: 'firstname', content: jsonData.firstname },
          {
            name: 'contacts',
            content: jsonData.contacts.map(
              (c: {
                contactIcon: string;
                contactContent: string;
                contactOrder: string;
              }) => ({
                icon: c.contactIcon,
                iconSize: 16,
                content: c.contactContent,
                order: c.contactOrder,
              }),
            ),
          },
          {
            name: 'title',
            content: jsonData.cvTitle.title,
            advice: jsonData.cvTitle.titleAdvice,
          },
          {
            name: 'presentation',
            content: jsonData.profilePresentation.presentation,
            advice: jsonData.profilePresentation.presentationAdvice,
          },
          {
            name: 'experiences',
            content: jsonData.experiences.map((item) => ({
              title: item.postTitle,
              date: item.postDate,
              company: item.postCompany,
              contrat: item.postContrat,
              content: item.postDescription,
              order: item.postOrder,
              score: item.postScore,
              high: item.postHigh,
              weak: item.postWeak,
            })),
          },
          ...jsonData.sections.map((section) => ({
            name: section.sectionName.trim().toLocaleLowerCase(),
            content: section.sectionContent.trim(),
            order: section.sectionOrder,
            advice: section.sectionAdvice,
            editable: true,
          })),
        ];

        // CVMINUTE SECTIONS
        const editableSections = allSections.filter(
          (item) =>
            item.content &&
            typeof item.content === 'string' &&
            item.name !== 'profile' &&
            item.name !== 'name' &&
            item.name !== 'firstname' &&
            item.name !== 'title' &&
            item.name !== 'presentation',
        );

        if (editableSections.length > 0) {
          await Promise.all(
            editableSections.map(async (item, index) => {
              if (typeof item.content === 'string') {
                const cvMinuteSection = await prisma.cvMinuteSection.create({
                  data: {
                    name: item.name,
                    content: item.content,
                    order: !isNaN(Number(item.order)) ? Number(item.order) : 1,
                    restricted:
                      editableSections.length > 1 &&
                      index !== 1 &&
                      premiumCards.length === 0 &&
                      boosterCards.length === 0,
                    editable: true,
                    cvMinuteId: cvMinute.id,
                  },
                });

                await prisma.advice.create({
                  data: {
                    type: 'cvMinuteSectionAdvice',
                    content: item.advice ?? '',
                    cvMinuteSectionId: cvMinuteSection.id,
                  },
                });
              }
            }),
          );
        }

        await Promise.all(
          allSections.map(async (s) => {
            if (s.content && typeof s.content === 'string') {
              // PROFILE & NAME & FIRSTNAME & TITLE & PRESENTATION
              if (
                s.name === 'profile' ||
                s.name === 'name' ||
                s.name === 'firstname'
              ) {
                await prisma.cvMinuteSection.create({
                  data: {
                    name: s.name,
                    content: s.content,
                    editable: false,
                    cvMinuteId: cvMinute.id,
                  },
                });
              } else if (s.name === 'title' || s.name === 'presentation') {
                const cvMinuteSection = await prisma.cvMinuteSection.create({
                  data: {
                    name: s.name,
                    content: s.content,
                    editable: false,
                    cvMinuteId: cvMinute.id,
                  },
                });

                await prisma.advice.create({
                  data: {
                    type: 'cvMinuteSectionAdvice',
                    content: s.advice ?? '',
                    cvMinuteSectionId: cvMinuteSection.id,
                  },
                });
              }
            } else {
              if (Array.isArray(s.content)) {
                await Promise.all(
                  s.content.map(async (item, index) => {
                    const cvMinuteSection = await prisma.cvMinuteSection.create(
                      {
                        data: {
                          name: s.name,
                          title: item.title,
                          content: item.content
                            ? s.name === 'experiences'
                              ? formatTextWithStrong(item.content)
                              : item.content
                            : '',
                          date: item.date,
                          company: item.company,
                          contrat: item.contrat,
                          icon: item.icon,
                          iconSize: 16,
                          order: Number(item.order) ?? 1,
                          restricted:
                            s.name === 'experiences' &&
                            index !== 1 &&
                            premiumCards.length === 0 &&
                            boosterCards.length === 0,
                          cvMinuteId: cvMinute.id,
                        },
                      },
                    );

                    if (item.score) {
                      await prisma.evaluation.create({
                        data: {
                          initialScore: Number(item.score) ?? 0,
                          actualScore: Number(item.score) ?? 0,
                          content: item.high ?? '',
                          weakContent: item.weak,
                          cvMinuteSectionId: cvMinuteSection.id,
                        },
                      });
                    }
                  }),
                );
              }
            }
          }),
        );

        // CREATE DOMAIN
        await Promise.all(
          jsonData.domains.map(async (item) => {
            const existDomain = await prisma.cvMinuteDomain.findFirst({
              where: { content: item.trim() },
            });

            if (!existDomain) {
              await prisma.cvMinuteDomain.create({
                data: {
                  content: item.trim(),
                  cvMinuteId: cvMinute.id,
                  userId: user.id,
                },
              });
            }
          }),
        );

        // CVMINUTE EVALUATION
        await prisma.evaluation.create({
          data: {
            initialScore: Number(jsonData.evaluations.globalScore),
            actualScore: Number(jsonData.evaluations.globalScore),
            content: jsonData.evaluations.recommendations,
            cvMinuteId: cvMinute.id,
          },
        });

        // CVMINUTE ADVICE
        await prisma.advice.create({
          data: {
            type: 'cvMinuteAdvice',
            content: jsonData.newSectionsAdvice,
            cvMinuteId: cvMinute.id,
          },
        });
      }

      if (cvMinuteCount > 0) {
        totalTokens = inputTokens + outputTokens;

        await updateCvMinutePayments({
          totalTokens,
          freeCard,
          premiumCards,
          boosterCards,
        });
      }

      const cardIds = [
        freeCard.id,
        ...premiumCards.map((item) => item.id),
        ...boosterCards.map((item) => item.id),
      ];

      const payments = await prisma.payment.findMany({
        where: { id: { in: cardIds } },
        include: { credit: true },
      });

      res.status(201).json({
        cvMinuteId: cvMinute.id,
        cvMinuteCount: cvMinuteCount + 1,
        payments,
      });
      return;
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ unknownError: error });
    }
    return;
  }
};

export { addCvMinute };
