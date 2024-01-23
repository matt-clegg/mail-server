import { readItems } from "@directus/sdk";

export default defineEventHandler(async () => {
    const client = useDirectusClient();
    if (!client) {
        return;
    }

    return await client.request(readItems("news"));
});
