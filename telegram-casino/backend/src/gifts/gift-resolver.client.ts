import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';

export interface GiftPreview {
  name: string;
  editionNumber: number;
  model: string;
  symbol: string;
  backdropName: string;
  backdropColor: string;
  imageUrl: string | null;
  telegramSlug: string;
}

export class GiftNotFoundError extends Error {}
export class GiftResolverUnavailableError extends Error {}
export class GiftResolverTimeoutError extends Error {}

interface ExecFileError extends Error {
  killed?: boolean;
  stderr?: string;
}

function execFileWithCallback(
  command: string,
  args: string[],
  options: { timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stderr }));
        return;
      }
      resolve({ stdout: stdout as string, stderr: stderr as string });
    });
  });
}

@Injectable()
export class GiftResolverClient {
  constructor(private readonly configService: ConfigService) {}

  async resolve(slug: string): Promise<GiftPreview> {
    const pythonPath = this.configService.get<string>('GIFT_RESOLVER_PYTHON') ?? 'python3';
    const scriptPath =
      this.configService.get<string>('GIFT_RESOLVER_SCRIPT') ?? 'services/gift-resolver/resolve_gift.py';

    try {
      const { stdout } = await execFileWithCallback(pythonPath, [scriptPath, slug], { timeout: 10_000 });
      return JSON.parse(stdout) as GiftPreview;
    } catch (error) {
      const execError = error as ExecFileError;
      if (execError.killed) {
        throw new GiftResolverTimeoutError(`Resolving ${slug} timed out`);
      }

      let parsedErrorCode: string | undefined;
      if (execError.stderr) {
        try {
          parsedErrorCode = (JSON.parse(execError.stderr) as { error?: string }).error;
        } catch {
          parsedErrorCode = undefined;
        }
      }

      if (parsedErrorCode === 'gift_not_found') {
        throw new GiftNotFoundError(`No gift found for slug ${slug}`);
      }
      throw new GiftResolverUnavailableError(`Gift resolver failed for slug ${slug}`);
    }
  }
}
