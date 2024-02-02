#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import * as p from '@clack/prompts';
import { grey } from 'kleur/colors';
import { execa } from 'execa';

const { version } = JSON.parse(
    fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'),
);

let cwd = process.argv[2] || '.';

console.log(grey(`Welcome to create-oweb! v${version}`));

p.intro('create-oweb');

if (cwd === '.') {
    const dir = await p.text({
        message: 'Where should we create your project?',
        placeholder: '  (hit Enter to use current directory)',
    });

    if (p.isCancel(dir)) process.exit(1);

    if (dir) {
        cwd = dir;
    }
}

if (fs.existsSync(cwd)) {
    if (fs.readdirSync(cwd).length > 0) {
        const force = await p.confirm({
            message: 'Directory not empty. Continue?',
            initialValue: false,
        });

        // bail if `force` is `false` or the user cancelled with Ctrl-C
        if (force !== true) {
            process.exit(1);
        }
    }
}

const options = await p.group(
    {
        template: () =>
            p.select({
                message: 'Which Oweb template would you like to use?',
                initialValue: 'typescript',
                options: [
                    {
                        label: 'JavaScript',
                        value: 'javascript',
                    },
                    {
                        label: 'TypeScript',
                        value: 'typescript',
                    },
                ],
            }),
        uwebsockets: () =>
            p.confirm({
                message: 'Do you want to enable uWebSockets support? (you can enable this later)',
                initialValue: false,
            }),

        features: () =>
            p.multiselect({
                message: 'Select additional options (use arrow keys/space bar)',
                required: false,
                initialValues: [],
                options: [
                    {
                        value: '@fastify/cors',
                        label: 'Add @fastify/cors for CORS support',
                    },
                    {
                        value: '@fastify/static',
                        label: 'Add @fastify/static for serving static files',
                    },
                    {
                        value: '@fastify/multipart',
                        label: 'Add @fastify/multipart for file uploads',
                    },
                    {
                        value: '@fastify/websocket',
                        label: 'Add @fastify/websocket for WebSocket support',
                    },
                    {
                        value: '@fastify/rate-limit',
                        label: 'Add @fastify/rate-limit for rate limiting',
                    },
                ],
            }),
        package_manager: () =>
            p.select({
                message: 'Which package manager do you want to use?',
                initialValue: 'npm',
                options: [
                    { label: 'npm', value: 'npm' },
                    { label: 'pnpm', value: 'pnpm' },
                    { label: 'yarn', value: 'yarn' },
                ],
            }),
    },
    { onCancel: () => process.exit(1) },
);

if (options.template === 'typescript') {
    const swc = await p.confirm({
        message: 'Do you want to enable @swc/core for faster builds?',
        initialValue: false,
    });

    if (swc) {
        options.features.push('@swc/core');
    }
}

p.outro('🚀 I copied the proper template and made your project ready 😁');

const { uwebsockets, features, package_manager } = options;

if (!fs.existsSync(cwd)) {
    fs.mkdirSync(cwd);
}

const commands = ['npx degit owebjs/templates/' + options.template + ' --force'];

if (features.length > 0) {
    commands.push(
        `${package_manager} ${package_manager == 'yarn' ? 'add' : 'install'} -D ${features.join(
            ' ',
        )}`,
    );
}

for await (const command of commands) {
    await execa(command, {
        cwd: path.relative(process.cwd(), cwd),
        stdio: 'inherit',
        shell: true,
    });
}

const imports = features
    .map((f: string) => {
        if (f !== '@swc/core') {
            return `import ${f.replace('@', '').split('/')[1].replace('-', '_')[0].toUpperCase()}${f
                .replace('@', '')
                .split('/')[1]
                .replace('-', '')
                .slice(1)} from '${f}';`;
        } else {
            return '';
        }
    })
    .filter(Boolean)
    .join('\n');

const fastifyPlugins = features
    .map((f: string) => {
        if (f !== '@swc/core') {
            return `    await oweb.register(${f
                .replace('@', '')
                .split('/')[1]
                .replace('-', '_')[0]
                .toUpperCase()}${f.replace('@', '').split('/')[1].replace('-', '').slice(1)});`;
        } else {
            return '';
        }
    })
    .filter(Boolean)
    .join('\n');

patch(`{{uWebSocketsEnabled}}`, `${uwebsockets}`);
patch(`{{imports}}`, imports);
patch(`{{fastifyPlugins}}`, fastifyPlugins);

function patch(file: string, string: string) {
    const indexFile = path.join(
        cwd,
        `src/index.${options.template === 'typescript' ? 'ts' : 'js'}`,
    );

    fs.writeFileSync(indexFile, fs.readFileSync(indexFile, 'utf-8').replace(file, string));
}

await p
    .confirm({
        message: 'Do you want to initialize a git repository?',
        initialValue: false,
    })
    .then(async (initGit) => {
        if (initGit) {
            await execa('git', ['init'], {
                cwd: path.relative(process.cwd(), cwd),
            });
        }
    });

console.log(
    `✨ Oweb project has been created. Next steps: ${
        cwd === '.' ? '' : `\n› cd ${path.relative(process.cwd(), cwd)}`
    }\n› ${package_manager} ${package_manager === 'yarn' ? 'dev' : 'run dev'}`,
);
