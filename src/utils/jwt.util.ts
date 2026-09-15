import jwt from "jsonwebtoken";
import {ENV} from "../config/env.js";

const SECRET_KEY = ENV.JWT_SECRET;
const EXPIRES_IN = "90d";


export const generateToken = (payload: object) => {
  return jwt.sign(payload, SECRET_KEY || "", { expiresIn: EXPIRES_IN });
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, SECRET_KEY || "");
  } catch (error) {
    return error;
  }
};