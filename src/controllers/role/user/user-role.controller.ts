import prisma from '@/lib/db';
import { Request, Response } from 'express';

const acceptConditions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user } = res.locals;

    await prisma.user.update({
      where: { id: user.id },
      data: { acceptConditions: true },
    });

    res.status(200).json({ user: { acceptConditions: true } });
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

export { acceptConditions };
