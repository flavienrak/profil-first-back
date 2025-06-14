import prisma from '@/lib/db';
import Stripe from 'stripe';

import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { stripe } from '@/socket';
import { currency } from '@/utils/constants';
import { expirationDate } from '@/utils/payment/expriation';
import { getCredit } from '@/utils/payment/credit';

const frontendUri = process.env.FRONTEND_URI;

const stripeController = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { user } = res.locals;
    const body: { amount: number; name: string; type: string } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: body.name },
            unit_amount: body.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendUri}/payment/{CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUri}/mon-plan`,
    });

    let expiredAt: Date | null = null;

    if (body.type === 'premium' || body.type === 'quali-carriere') {
      expiredAt = expirationDate(body.type);
    }

    const payment = await prisma.payment.create({
      data: {
        amount: body.amount,
        name: body.name,
        type: body.type,
        currency,
        sessionId: session.id,
        status: session.payment_status,
        expiredAt,
        userId: user.id,
      },
    });

    res.json({ payment });
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

const stripeSessionController = async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  try {
    const { user } = res.locals;

    // Récupérer les détails de la session Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });

    let payment = await prisma.payment.findUnique({
      where: { sessionId: session.id },
    });

    if (!payment) {
      res.json({ paymentNotFound: true });
      return;
    }

    if (payment) {
      // Mettre à jour le paiement en base
      payment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: session.payment_status as string },
      });
    }

    let credit = await prisma.credit.findUnique({
      where: { paymentId: payment.id },
    });

    if (payment.status === 'paid' && !credit) {
      const creditValue = getCredit(payment.type);

      if (creditValue) {
        credit = await prisma.credit.create({
          data: {
            value: creditValue,
            paymentId: payment.id,
            userId: user.id,
          },
        });
      }
    }

    payment = await prisma.payment.findUnique({
      where: { sessionId: session.id },
      include: { credit: true },
    });

    res.json({ payment });
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

export { stripeController, stripeSessionController };
