import app from "./app";
import { ENV } from "./config/env";

app.listen(ENV.port, () => {
    console.log(`Server started on port http://localhost:${ENV.port}`);
});