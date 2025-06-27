import dotenv from 'dotenv';

dotenv.config();

const backendPort = process.env.BACKEND_PORT as string;
const frontendUri = process.env.FRONTEND_URI as string;

const openaiApiKey = process.env.OPENAI_API_KEY as string;
const jwtSecretKey = process.env.JWT_SECRET_KEY as string;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;

const premiumPriceId = process.env.STRIPE_PREMIUM_PRICE_ID as string;
const boosterPriceId = process.env.STRIPE_BOOSTER_PRICE_ID as string;
const qualiCarrierePriceId = process.env
  .STRIPE_QUALI_CARRIERE_PRICE_ID as string;

const smtpHost = process.env.SMTP_HOST as string;
const smtpPort = process.env.SMTP_PORT as string;
const smtpUser = process.env.SMTP_USER as string;
const smtpPass = process.env.SMTP_PASS as string;

const contactMail = process.env.CONTACT_MAIL as string;

const authTokenName = process.env.AUTH_TOKEN_NAME as string;

export {
  backendPort,
  frontendUri,
  // KEY
  openaiApiKey,
  jwtSecretKey,
  stripeSecretKey,
  // PAYMENT
  premiumPriceId,
  boosterPriceId,
  qualiCarrierePriceId,
  // MAIL
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  // MAIL
  contactMail,
  // TOKEN
  authTokenName,
};
