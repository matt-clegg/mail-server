import copy from "rollup-plugin-copy";

// https://nitro.unjs.io/config
export default defineNitroConfig({
    experimental: {
        asyncContext: true
    },

    preset: "vercel",
    logLevel: 3,

    runtimeConfig: {
        emailBatchSize: 50,
        emailDomain: "",
        publicUrl: "",

        directus: {
            url: "",
            token: "",
        },

        postmark: {
            url: "",
            smtpPassword: ""
        }
    },

    rollupConfig: {
        plugins: [
            copy({
                targets: [
                    { src: "templates/*", dest: ".nitro/dev/templates" },
                    { src: "templates/*", dest: ".output/server/templates" }
                ]
            })
        ]
    }
});
