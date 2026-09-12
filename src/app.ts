import Elysia from "elysia";

const app = new Elysia();

app.get("/", async () => {
    return "Hello World";
});

export default app;