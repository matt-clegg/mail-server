import { readItems } from "@directus/sdk";
import { EventHandlerRequest, H3Event } from "h3";
import { consola } from "consola";

export type FullAddress = {
    Email: string,
    Name?: string,
    MailboxHash?: string
}

export type Header = {
    Name: string,
    Value: string
}

export type Attachment = {
    Name: string,
    Content: string,
    ContentType: string,
    ContentLength: number
}

export type InboundEmail = {
    FromName: string,
    MessageStream: string,
    From: string,
    FromFull: FullAddress,
    To: string,
    ToFull: FullAddress[],
    Cc: string,
    CcFull: FullAddress[],
    Bcc: string,
    BccFull: FullAddress[],
    OriginalRecipient: string,
    Subject: string,
    MessageID: string,
    MailboxHash: string,
    Date: string,
    TextBody: string,
    HtmlBody: string,
    StrippedTextReply: string,
    Tag: string;
    Headers: Header[],
    Attachments: Attachment[]
}

export type MailingList = {
    id: string,
    name: string,
    email_name: string
}

export type Subscriber = {
    mailing_list: number,
    email: string,
    user?: {
        email: string,
        first_name: string,
        last_name: string
    }
}

function getFromName(email: InboundEmail, mailingList: MailingList, emailDomain: string) {
    let from: string;

    if (!email.FromName || email.FromName === "") {
        const emailNamePart = email.From.split("@")[0];
        from = `${emailNamePart} via ${mailingList.name} <${mailingList.email_name}@${emailDomain}>`;
    } else {
        from = `${email.FromName} via ${mailingList.name} <${mailingList.email_name}@${emailDomain}>`;
    }

    return from;
}

function getUnsubscribeUrl(mailingList: MailingList) {
    const encodedListId = encodeURIComponent(btoa(mailingList.id));
    const { publicUrl } = useRuntimeConfig(useEvent());
    return `${publicUrl}/unsubscribe/list?l${encodedListId}`;
}

function getReplyToEmailAddress(mailingList: MailingList) {
    const { emailDomain } = useRuntimeConfig(useEvent());
    return `${mailingList.email_name}@${emailDomain}`;
}

async function renderMailBody(htmlBody: string, mailingList: MailingList){
    await renderTemplate("demo", {
        content: htmlBody,
        mailingList: mailingList.name,
        unsubscribeLink: getUnsubscribeUrl(mailingList)
    });
}

async function sendToSubscribers(email: InboundEmail, subscribers: Subscriber[], mailingList: MailingList) {
    const { emailBatchSize, emailDomain } = useRuntimeConfig(useEvent());
    const subscriberChunks = chunkArray<Subscriber>(subscribers, emailBatchSize);

    const fromName = getFromName(email, mailingList, emailDomain)
    const postmark = usePostmark();

    let emailsFailed = 0;

    for (const subscriberChunk of subscriberChunks) {
        const emailsToSend = [];

        for (const subscriber of subscriberChunk) {
            const bodyInput = email.HtmlBody || email.TextBody;
            const body = await renderMailBody(bodyInput, mailingList);
            const unsubscribeUrl = getUnsubscribeUrl(mailingList);

            emailsToSend.push({
                To: subscriber.email,
                From: fromName,
                Subject: email.Subject,
                HtmlBody: body,
                ReplyTo: getReplyToEmailAddress(mailingList),
                TrackOpens: true,
                TrackLinks: "None",
                MessageStream: "broadcast",
                Attachments: email.Attachments,
                Headers: [
                    {
                        name: "Precedence",
                        value: "list"
                    },
                    {
                        name: "List-Id",
                        value: `${mailingList.name} <${mailingList.email_name}@${process.env.EMAIL_DOMAIN}>`,
                    },
                    {
                        name: "List-Unsubscribe",
                        value: unsubscribeUrl
                    },
                    {
                        name: "Original-Sender",
                        value: email.From
                    }
                ]
            });
        }

        const result = await postmark.sendBatchEmails(emailsToSend);
        emailsFailed += result.failedToSendCount;
    }

    consola.info(`Attempted to send to ${subscribers.length} subscribers of the ${mailingList.name} mailing list. ${emailsFailed} failed.`)
}

async function loadMailingList(mailingListName: string,client: ReturnType<typeof useDirectusClient>){
    const mailingLists = await client.request<MailingList[]>(readItems("mailing_lists", {
        filter: {
            email_name: {
                _eq: mailingListName.toLowerCase()
            }
        }
    }));

    return mailingLists.length > 0 ? mailingLists[0] : undefined;
}

async function trySendToMailingList(email: InboundEmail, mailingListAddress: FullAddress, client: ReturnType<typeof useDirectusClient>, event: H3Event<EventHandlerRequest>): Promise<boolean> {
    const toEmail = mailingListAddress.Email;
    const emailName = toEmail.split("@")[0];

    const mailingList = await loadMailingList(emailName, client);

    if (!mailingList) {
        consola.info("No mailing list found with name: " + emailName);
        return false;
    }

    let subscribers = await client.request<Subscriber[]>(readItems("mailing_list_subscriber", {
        fields: ["list", "email"],
        filter: {
            list: { _eq: mailingList.id }
        }
    }));

    if (!subscribers || subscribers.length === 0) {
        consola.info("No subscribers for mailing list: " + emailName);
        return false;
    }

    const isSubscribed = subscribers.some(s => s.email.toLowerCase() === email.From.toLowerCase());

    if (!isSubscribed) {
        consola.info(`Someone tried sending email to a mailing list they aren't subscribed to: ${email.From} -> ${mailingList.name}`);
        // TODO: Send an email to the sender saying they aren't subscribed to that mailing list
        // TODO: Put the email in a holding table?
        return false;
    }

    // Filter the subscribers so we don't send the email to the original sender
    subscribers = subscribers.filter(s => s.email.toLowerCase() !== email.From.toLowerCase());

    // TODO: Send the email to the subscribers
    await sendToSubscribers(email, subscribers, mailingList);

    return true;
}

export default defineEventHandler(async (event) => {
    const body = await readBody<InboundEmail>(event);

    const toAddress = body.ToFull;

    if (!toAddress || toAddress.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "Missing to address"
        });
    }

    const client = useDirectusClient();

    for (const address of toAddress) {
        await trySendToMailingList(body, address, client, event);
    }

    return "ok";
})
