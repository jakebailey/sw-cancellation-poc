import esbuild from 'esbuild';
import yargs from 'yargs-parser';

const { _, ...argv } = yargs(process.argv.slice(2)) || {};

esbuild.build({
    logLevel: 'info',
    bundle: true,
    outdir: 'public',
    sourcemap: true,
    format: 'esm',
    target: 'esnext',
    minify: true,
    entryPoints: {
        'sw-main': 'src/sw/main.ts',
        sw: 'src/sw/sw.ts',
        'sw-worker': 'src/sw/worker.ts',
    },
    ...argv,
});
