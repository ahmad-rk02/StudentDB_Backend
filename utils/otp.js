import bcrypt from 'bcrypt';

export const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const hashOTP = async (otp) => await bcrypt.hash(otp, 10);

export const compareHashedOTP = async (otp, hashedOtp) => await bcrypt.compare(otp, hashedOtp);
