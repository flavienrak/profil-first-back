import express from 'express';
import twilio from 'twilio';

import { login, logout, register } from '../controllers/auth.controller';
import {
  loginValidation,
  registerValidation,
} from '../validations/auth.validation';

const router = express.Router();

router.post('/login', loginValidation, login);
router.post('/register', registerValidation, register);
router.get('/logout', logout);

router.post(
  '/',
  async (req: express.Request, res: express.Response): Promise<void> => {
    try {
      const body: { receiver: string } = req.body;
      const accountSid = process.env.TWILIO_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const messagingServiceSid = process.env.TWILIO_SERVICE_SID;

      const twilioClient = twilio(accountSid, authToken);
      const message = await twilioClient.messages.create({
        body: `Bonjour\nKolly france.fr`,
        // from: '+19787672511',
        to: body.receiver,
        messagingServiceSid,
      });

      res.status(200).json({ message });
      return;
    } catch (error) {
      res.status(500).json({ error: `${error.message}` });
      return;
    }
  },
);

export default router;
