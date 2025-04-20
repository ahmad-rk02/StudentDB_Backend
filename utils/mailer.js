 


import nodemailer from 'nodemailer';

export const sendOTPEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail', // or another provider
    auth: {
      user: 'mdahmadrazakhan751@gmail.com',
      pass: 'qjcw hqyg wohw zhlh',
    },
  });

  const message = {
    from: 'no-reply" <mdahmadrazakhan751@gmail.com>',
    to,
    subject: 'Your OTP Code',
    html: `<p>Your OTP is: <strong>${otp}</strong></p>`,
  };

  await transporter.sendMail(message);
};
