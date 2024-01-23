import { createDirectus, rest, staticToken } from "@directus/sdk";

export function useDirectusClient() {
    const { url, token } = useRuntimeConfig(useEvent()).directus;

    return createDirectus(url)
        .with(staticToken(token))
        .with(rest());
}
