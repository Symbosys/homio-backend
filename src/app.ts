import Elysia from "elysia";

const app = new Elysia();

app.get("/", async () => {
    return "Homio Backend is running..."
});

app.get("/health", async ({ set }) => {
    set.status = 200;
    return "OK";
});

export default app;