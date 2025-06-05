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

const uniqueId = crypto.randomBytes(4).toString('hex');

const addCvMinute = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
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

      // OPENAI
      let textData = '';
      if (req.file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        textData = pdfData.text;
      } else {
        const wordData = await mammoth.extractRawText({ path: filePath });
        textData = wordData.value;
      }

      const normalized = textData.replace(/(\r?\n\s*){2,}/g, '\\n').trim();

      cvMinute = await prisma.cvMinute.update({
        where: { id: cvMinute.id },
        data: { content: normalized },
      });

      const openaiResponse = await gpt4([
        { role: 'system', content: addCvMinutePrompt.trim() },
        {
          role: 'user',
          content: `
            CV : ${normalized}\n

            Offre ciblée :
            ${body.position}
          `.trim(),
        },
      ]);

      if ('error' in openaiResponse) {
        res.json({ openaiError: openaiResponse.error });
        return;
      }

      for (const r of openaiResponse.choices) {
        await prisma.openaiResponse.create({
          data: {
            responseId: openaiResponse.id,
            cvMinuteId: cvMinute.id,
            request: 'cv-infos',
            response: r.message.content ?? 'cv-infos-response',
            index: r.index,
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
        } = extractJson(r.message.content);

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
          withAdvice?: {
            content: string;
            advice: string;
          };
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
            withAdvice: {
              content: jsonData.cvTitle.title,
              advice: jsonData.cvTitle.titleAdvice,
            },
          },
          {
            name: 'presentation',
            withAdvice: {
              content: jsonData.profilePresentation.presentation,
              advice: jsonData.profilePresentation.presentationAdvice,
            },
          },
          {
            name: 'experiences',
            content: jsonData.experiences.map(
              (item: {
                postTitle: string;
                postDate: string;
                postCompany: string;
                postContrat: string;
                postDescription: string;
                postOrder: string;
                postScore: string;
                postHigh: string;
                postWeak: string;
              }) => ({
                title: item.postTitle,
                date: item.postDate,
                company: item.postCompany,
                contrat: item.postContrat,
                content: item.postDescription,
                order: item.postOrder,
                score: item.postScore,
                high: item.postHigh,
                weak: item.postWeak,
              }),
            ),
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
        await Promise.all(
          allSections.map(async (s) => {
            if (s.content && typeof s.content === 'string') {
              // PROFILE & NAME & FIRSTNAME & SECTIONS
              const cvMinuteSection = await prisma.cvMinuteSection.create({
                data: {
                  name: s.name,
                  content: s.content,
                  order: !isNaN(Number(s.order)) ? Number(s.order) : 1,
                  editable: s.editable,
                  cvMinuteId: cvMinute.id,
                },
              });

              if (s.advice) {
                await prisma.advice.create({
                  data: {
                    type: 'cvMinuteSectionAdvice',
                    content: s.advice,
                    cvMinuteSectionId: cvMinuteSection.id,
                  },
                });
              }
            } else if (s.withAdvice) {
              // TITLE & PRESENTATION
              const cvMinuteSection = await prisma.cvMinuteSection.create({
                data: {
                  name: s.name,
                  content: s.withAdvice.content,
                  cvMinuteId: cvMinute.id,
                },
              });

              await prisma.advice.create({
                data: {
                  type: 'cvMinuteSectionAdvice',
                  content: s.withAdvice.advice,
                  cvMinuteSectionId: cvMinuteSection.id,
                },
              });
            } else {
              if (Array.isArray(s.content)) {
                await Promise.all(
                  s.content.map(async (item) => {
                    const cvMinuteSection = await prisma.cvMinuteSection.create(
                      {
                        data: {
                          name: s.name,
                          title: item.title,
                          content: item.content
                            ? formatTextWithStrong(item.content)
                            : '',
                          date: item.date,
                          company: item.company,
                          contrat: item.contrat,
                          icon: item.icon,
                          iconSize: 16,
                          order: Number(item.order) ?? 1,
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
    }

    res.status(201).json({ cvMinuteId: cvMinute.id });
    return;
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
