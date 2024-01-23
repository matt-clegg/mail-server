import path from 'node:path';
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";
import fse from 'fs-extra';
import { consola } from "consola";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templateExtension = ".liquid";

const liquid = new Liquid({
    root: path.resolve(__dirname, 'templates'),
    extname: templateExtension
});

export async function renderTemplate(template: string, variables: Record<string, any>) {
    const templatePath = path.join(__dirname, "templates", template + templateExtension);

    const templateExists = await fse.pathExists(templatePath);
    if (!templateExists) {
        throw new Error(`Template ${templatePath} doesn't exist`);
    }

    const templateString = await fse.readFile(templatePath, "utf8");
    const html = await liquid.parseAndRender(templateString, variables);

    consola.info("RENDERED HTML", html)

    return html;
}

