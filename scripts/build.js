import esbuild from 'esbuild';
import yargs from 'yargs-parser';

const { _, ...argv } = yargs(process.argv.slice(2)) || {};

esbuild
    .build({
        logLevel: 'info',
        bundle: true,
        outdir: 'public',
        sourcemap: true,
        format: 'iife',
        target: 'es2020',
        minify: true,
        entryPoints: {
            sw: 'src/sw/sw.ts',
            'sw-page': 'src/sw/page.ts',
            'sw-worker': 'src/sw/worker.ts',
        },
        ...argv,
    })
    .catch(() => process.exit(1));
