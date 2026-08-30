export type OperationsAdminArguments = {
  apply: boolean;
  help?: boolean;
  email?: string;
  displayName?: string;
};

export function parseOperationsAdminArguments(arguments_: string[]): OperationsAdminArguments {
  const result: OperationsAdminArguments = { apply: false };

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--apply') {
      result.apply = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument === '--password' || argument.startsWith('--password=')) {
      throw new Error('Password arguments are forbidden. Use the hidden interactive prompt.');
    }
    if (argument === '--email' || argument === '--display-name') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      const key = argument === '--email' ? 'email' : 'displayName';
      if (result[key]) throw new Error(`${argument} may be provided only once.`);
      result[key] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return result;
}
