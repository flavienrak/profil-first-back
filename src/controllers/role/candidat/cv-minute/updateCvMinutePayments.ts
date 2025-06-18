import prisma from '@/lib/db';

import { PaymentInterface } from '@/interfaces/payment.interface';

const now = new Date();

const updateCvMinutePayments = async (data: {
  totalTokens: number;
  freeCard: PaymentInterface;
  premiumCards: PaymentInterface[];
  boosterCards: PaymentInterface[];
}) => {
  let actualTokens = data.totalTokens;

  if (data.freeCard.credit && data.freeCard.credit.value > 0) {
    if (data.freeCard.credit.value > actualTokens) {
      await prisma.credit.update({
        where: { id: data.freeCard.credit.id },
        data: { value: data.freeCard.credit.value - actualTokens },
      });

      actualTokens = 0;
    } else {
      await prisma.credit.update({
        where: { id: data.freeCard.credit.id },
        data: { value: 0 },
      });

      actualTokens = actualTokens - data.freeCard.credit.value;
    }
  }

  if (actualTokens > 0) {
    for (const item of data.premiumCards) {
      if (
        actualTokens > 0 &&
        item.expiredAt &&
        new Date(item.expiredAt) > now
      ) {
        if (item.credit && item.credit.value > 0) {
          if (item.credit.value > actualTokens) {
            await prisma.credit.update({
              where: { id: item.credit.id },
              data: { value: item.credit.value - actualTokens },
            });

            actualTokens = 0;
          } else {
            await prisma.credit.update({
              where: { id: item.credit.id },
              data: { value: 0 },
            });

            actualTokens = actualTokens - item.credit.value;
          }
        }
      }
    }
  }

  if (actualTokens > 0) {
    for (const item of data.boosterCards) {
      if (actualTokens > 0) {
        if (item.credit && item.credit.value > 0) {
          if (item.credit.value > actualTokens) {
            await prisma.credit.update({
              where: { id: item.credit.id },
              data: { value: item.credit.value - actualTokens },
            });

            actualTokens = 0;
          } else {
            await prisma.credit.update({
              where: { id: item.credit.id },
              data: { value: 0 },
            });

            actualTokens = actualTokens - item.credit.value;
          }
        }
      }
    }
  }
};

export { updateCvMinutePayments };
