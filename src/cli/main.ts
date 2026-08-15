import { VERSION } from '../version.js';
import { runBuildCommand } from './build-command.js';
import { ExitCode, type ExitCodeValue } from './exit-codes.js';
import { parseCliArgs } from './parse-args.js';
import { createReporter, type CliStreams } from './reporter.js';
import { runValidateCommand } from './validate-command.js';

export function main(
  argv: readonly string[],
  projectRoot = process.cwd(),
  streams?: CliStreams,
): ExitCodeValue {
  try {
    const options = parseCliArgs(argv);
    const reporter = createReporter(options.logLevel, options.json, streams);
    if (options.version) {
      reporter.result({ success: true, version: VERSION }, VERSION);
      return ExitCode.success;
    }
    if (options.help || !options.command) {
      reporter.result({ success: true, help: HELP_TEXT }, HELP_TEXT);
      return options.help ? ExitCode.success : ExitCode.validation;
    }
    if (options.command === 'build') return runBuildCommand(projectRoot, options, reporter);
    return runValidateCommand(projectRoot, options, reporter);
  } catch (error) {
    const debug = (process.env.LOG_LEVEL ?? '').toUpperCase() === 'DEBUG';
    const message = error instanceof Error ? error.message : 'Неизвестная CLI error.';
    const detail = error instanceof Error && debug ? error.stack : undefined;
    const json = argv.includes('--json');
    const output = json
      ? JSON.stringify({ success: false, exitCode: ExitCode.validation, error: message })
      : `ERROR: ${message}${detail ? `\n${detail}` : ''}`;
    const write = json
      ? (streams?.stdout ?? ((text: string) => process.stdout.write(text)))
      : (streams?.stderr ?? ((text: string) => process.stderr.write(text)));
    write(`${output}\n`);
    return ExitCode.validation;
  }
}

export const HELP_TEXT = `design-token-pipeline

Использование:
  design-token-pipeline build [tokens.json] [options]
  design-token-pipeline validate [tokens.json] [options]

Options:
  -c, --config <path>       JSON config file
  -o, --out-dir <path>      Output directory
  -f, --format <format>     css | typescript | tailwind (repeatable)
  -p, --prefix <prefix>     CSS custom property prefix
      --check               Проверить generated files без записи
      --strict              Считать warnings ошибками
      --json                Вывести один JSON result в stdout
      --log-level <level>   DEBUG | INFO | WARN | ERROR
  -h, --help                Показать help
  -v, --version             Показать version`;
