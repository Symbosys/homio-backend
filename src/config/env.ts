import dotenv from "dotenv";

dotenv.config();

export const ENV = {
    port: process.env.PORT || 4000,
    jwtSecret: process.env.JWT_SECRET!,


    cloudName: process.env.CLOUD_NAME,
    cloudApiKey: process.env.CLOUD_API_KEY,
    cloudApiSecret: process.env.CLOUD_API_SECRET,
    cloudFolder: process.env.CLOUD_FOLDER,

    mode: process.env.MODE,    
}