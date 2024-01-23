import { consola } from "consola";

type PostmarkResponse = {
    ErrorCode: number,
    Message: string,
    MessageID: string,
    SubmittedAt: string,
    To: string
}

export function usePostmark() {
    const { url, smtpPassword } = useRuntimeConfig(useEvent()).postmark;

    async function sendBatchEmails(data: any) {
        const result = await $fetch<PostmarkResponse[]>("/email/batch", {
            method: "POST",
            baseURL: url,
            body: data,
            headers: {
                "X-Postmark-Server-Token": smtpPassword
            }
        });

        const failedResults = result.filter(r => r.ErrorCode !== 0);

        if (failedResults.length > 0) {
            consola.info("Some batch emails failed to send:");

            for (const failure of failedResults) {
                consola.info(`(${failure.ErrorCode}) ${failure.Message}`);
            }
        }

        return {
            success: failedResults.length === 0,
            failedToSendCount: failedResults.length
        };
    }

    return {
        sendBatchEmails
    };
}
