import nodemailer from 'nodemailer';

import {
  contactMail,
  smtpHost,
  smtpPass,
  smtpPort,
  smtpUser,
} from '@/utils/env';

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: Number(smtpPort),
  secure: false,
  auth: { user: smtpUser, pass: smtpPass },
  tls: { rejectUnauthorized: false },
});

// VALIDATION CODE
async function sendVerificationEmail(data: {
  name: string;
  email: string;
  code: string;
}) {
  const mailOptions = {
    from: `"PROFILE FIRST" <${smtpUser}>`,
    to: data.email,
    subject: 'Code de validation',
    text: `Votre code de validation est: ${data.code}`,
    html: `
      <p>Bonjour ${data.name},</p>
      <p>Merci de rejoindre Profile First !</p>
      <p>Votre code de validation est : </p>
      <h2 style="letter-spacing: 4px;">${data.code}</h2>
      <p>Ce code est valable 15 minutes.</p>
      <p>Si vous n’êtes pas à l’origine de cette demande, 
      vous pouvez ignorer cet e-mail ; aucune action 
      supplémentaire ne sera effectuée.
      </p>
      <p>En cas de question, contactez notre support : 
        <a href="mailto:contact@profilefirst.io">contact@profilefirst.io</a>
      </p>
      <br>
      <p>À très bientôt,</p>
      <p>L’équipe Profile First</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// RESET PASSWORD
async function sendResetPasswordEmail(data: {
  name: string;
  email: string;
  link: string;
}) {
  const mailOptions = {
    from: `"PROFILE FIRST" <${smtpUser}>`,
    to: data.email,
    subject: 'Réinitialisation de mot de passe',
    text: `Demande de réinitialisation de mot de passe : ${data.link}`,
    html: `
      <p>Bonjour ${data.name},</p>
      <p>Vous avez demandé de réinitialiser votre mot de passe sur Profile First.</p>
      <p>Pour poursuivre cette action, cliquez sur le bouton suivant : </p>
      <br>
      <a href="${data.link}" style="margin: 24px 0; padding: 12px 24px; border-radius: 6px; background: #4461f2; color: #ffffff; cursor: pointer; text-decoration: none;">Réinitialiser</a>
      <br>
      <br>
      <p>Ce lien est valable 15 minutes.</p>
      <p>Si vous n’êtes pas à l’origine de cette demande, 
      vous pouvez ignorer cet e-mail ; aucune action 
      supplémentaire ne sera effectuée.
      </p>
      <p>En cas de question, contactez notre support : 
        <a href="mailto:contact@profilefirst.io">contact@profilefirst.io</a>
      </p>
      <br>
      <p>À très bientôt,</p>
      <p>L’équipe Profile First</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// RESERVATION CONTACT
async function sendReservationContactMail(data: {
  name: string;
  email: string;
  phone: string;
  date: string;
}) {
  const mailOptions = {
    from: `"PROFILE FIRST" <${smtpUser}>`,
    to: contactMail,
    subject: 'Résérvation séance',
    text: `Demande de résérvation séance : ${data.email}`,
    html: `
      <p>Bonjour,</p>
      <p>Un utilisateur de Profile First a demandé d'etre contacté.</p>
      <p>Nom : ${data.name}</p>
      <p>Adresse email : <a href="mailto:${data.email}">${data.email}</a></p>
      <p>Numéro téléphone : <a href="tel:${data.phone}">${data.phone}</a></p>
      <p>Date et Heure : ${data.date}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

export {
  sendVerificationEmail,
  sendResetPasswordEmail,
  sendReservationContactMail,
};
