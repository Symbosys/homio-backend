import dotenv from "dotenv";

dotenv.config();

export const ENV = {
    PORT: Number(process.env.PORT || 4000),
    JWT_SECRET: process.env.JWT_SECRET,


    CLOUD_NAME: process.env.CLOUD_NAME,
    CLOUD_API_KEY: process.env.CLOUD_API_KEY,
    CLOUD_API_SECRET: process.env.CLOUD_API_SECRET,
    CLOUD_FOLDER: process.env.CLOUD_FOLDER,

    MODE: process.env.MODE as "DEVELOPMENT" | "PRODUCTION",
}